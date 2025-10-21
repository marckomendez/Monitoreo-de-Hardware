// /utils/monitor.js
// Captura lecturas con systeminformation, asegura Host y evalúa umbrales.
// Robusto para Windows y para versiones de systeminformation donde si.time() es sincrónico.
const si = require('systeminformation');
const os = require('os');
const { sql, poolPromise } = require('../db');

// Cache host id to avoid querying/inserting Host every tick
let _cachedHostId = null;

// Lazy io getter to avoid repeated try/catch and circular require cost
let _cachedIO = undefined;
function getIO() {
  if (_cachedIO !== undefined) return _cachedIO;
  try { _cachedIO = require('../server').io; } catch (e) { _cachedIO = null; }
  return _cachedIO;
}

// Helper: ejecuta una fn async de si.* y si falla, devuelve fallback
async function safeSi(fn, fallback = {}) {
  try { return await fn(); } catch { return fallback; }
}

// Helper: si.time() puede ser sincrónico en algunas versiones
function safeTime() {
  try { return typeof si.time === 'function' ? si.time() : {}; } catch { return {}; }
}

/** Obtiene/crea el Host con columnas NOT NULL cubiertas */
async function ensureHost(pool) {
  if (_cachedHostId) return _cachedHostId;
  const [osInfo, cpu, mem] = await Promise.all([
    safeSi(() => si.osInfo()),
    safeSi(() => si.cpu()),
    safeSi(() => si.mem()),
  ]);

  const nombre = osInfo.hostname || os.hostname() || 'host-desconocido';
  const so = [osInfo.distro, osInfo.release, osInfo.arch].filter(Boolean).join(' ').trim() || os.type();
  const cpu_model = cpu.brand || cpu.manufacturer || 'CPU';
  const ram_total_gb = Number((((mem.total ?? 0) / (1024 ** 3)) || 0).toFixed(2));

  // ¿Existe?
  let rs = await pool.request()
    .input('nombre', sql.NVarChar, nombre)
    .query('SELECT id FROM dimo.Host WHERE nombre = @nombre');

  if (rs.recordset.length > 0) {
    _cachedHostId = rs.recordset[0].id;
    return _cachedHostId;
  }

  // Insertar host
  rs = await pool.request()
    .input('nombre', sql.NVarChar, nombre)
    .input('so', sql.NVarChar, so)
    .input('cpu_model', sql.NVarChar, cpu_model)
    .input('ram_total_gb', sql.Decimal(7, 2), ram_total_gb)
    .query(`
      INSERT INTO dimo.Host (nombre, so, cpu_model, ram_total_gb)
      OUTPUT INSERTED.id
      VALUES (@nombre, @so, @cpu_model, @ram_total_gb)
    `);

  _cachedHostId = rs.recordset[0].id;
  return _cachedHostId;
}

/** Inserta lectura y devuelve id (BIGINT en tu esquema) */
async function insertLectura(pool, hostId, metrica, valor, unidad) {
  const ins = await pool.request()
    .input('host_id', sql.Int, hostId)
    .input('metrica', sql.NVarChar, metrica)
    .input('valor', sql.Decimal(18, 4), Number(valor))
    .input('unidad', sql.NVarChar, unidad || null)
    .query(`
      INSERT INTO dimo.Lectura (host_id, metrica, valor, unidad, tomado_en)
      OUTPUT INSERTED.id
      VALUES (@host_id, @metrica, @valor, @unidad, SYSUTCDATETIME())
    `);
  return ins.recordset[0].id;
}

/** Evalúa umbrales y crea alertas si procede (sin duplicar ABIERTAS) */
async function evaluarUmbrales(pool, hostId, metrica, valor, lecturaId) {
  const u = await pool.request()
    .input('metrica', sql.NVarChar, metrica)
    .query(`SELECT id, operador, valor, severidad FROM dimo.Umbral WHERE metrica = @metrica`);

  const abrirSi = (op, v, t) => (op === '>'  ? v >  t
    : op === '>=' ? v >= t
    : op === '<'  ? v <  t
    : op === '<=' ? v <= t
    : false);

  const abiertas = [];
  const ums = u.recordset || [];
  if (ums.length === 0) return abiertas;

  // Obtener los umbral ids candidatos que cumplen la condicion
  const umCandidatos = ums.filter(um => abrirSi(um.operador, Number(valor), Number(um.valor)));
  if (umCandidatos.length === 0) return abiertas;

  // Obtener en una sola query los umbrales que ya tienen alerta ABIERTA para este host
  const ids = umCandidatos.map(x => Number(x.id)).filter(Number.isFinite);
  let existentesSet = new Set();
  if (ids.length > 0) {
    const idsList = ids.join(',');
    const existeRs = await pool.request()
      .input('host_id', sql.Int, hostId)
      .query(`
        SELECT DISTINCT umbral_id FROM dimo.Alerta
        WHERE host_id = @host_id AND estado = N'ABIERTA' AND umbral_id IN (${idsList})
      `);
    (existeRs.recordset || []).forEach(r => existentesSet.add(Number(r.umbral_id)));
  }

  // Insertar alertas solo para los umbrales que no tienen alerta abierta
  const insertPromises = [];
  for (const um of umCandidatos) {
    if (existentesSet.has(Number(um.id))) continue;
    insertPromises.push(
      pool.request()
        .input('host_id', sql.Int, hostId)
        .input('umbral_id', sql.Int, um.id)
        .input('lectura_id', sql.BigInt, lecturaId)
        .input('severidad', sql.NVarChar, um.severidad)
        .query(`
          INSERT INTO dimo.Alerta (host_id, umbral_id, lectura_id, severidad, estado, creado_en)
          VALUES (@host_id, @umbral_id, @lectura_id, @severidad, N'ABIERTA', SYSUTCDATETIME())
        `)
        .then(() => ({ umbral_id: um.id, severidad: um.severidad }))
        .catch(err => { console.error('[evaluarUmbrales] error insert alerta', err); return null; })
    );
  }

  const results = await Promise.all(insertPromises);
  results.forEach(r => { if (r) abiertas.push(r); });
  return abiertas;
}

/** Captura + inserciones + evaluación de umbrales */

async function capturarYEvaluar(pool) {
  const hostId = await ensureHost(pool);

  // Llamadas seguras en paralelo
  const [mem, diskIO, temp] = await Promise.all([
    safeSi(() => si.mem()),
    safeSi(() => si.disksIO()),
    safeSi(() => si.cpuTemperature()),
  ]);
  const time = safeTime(); // síncrono en algunas versiones

  const lecturas = [];

  // RAM_USED_GB (fallbacks)
  const memTotal = Number(mem.total ?? 0);
  const memAvailable = Number(mem.available ?? mem.free ?? 0);
  const memUsed = Number(mem.used ?? (memTotal - memAvailable));
  if (memTotal > 0 && Number.isFinite(memUsed)) {
    const usedGb = memUsed / (1024 ** 3);
    lecturas.push({ metrica: 'RAM_USED_GB', valor: Number(usedGb.toFixed(2)), unidad: 'GB' });
  }

  // DISK_READ/WRITE_MBPS (si no hay métricas, usa 0.00)
  const rSec = diskIO && Number.isFinite(diskIO.rIO_sec) ? Number(diskIO.rIO_sec) : 0;
  const wSec = diskIO && Number.isFinite(diskIO.wIO_sec) ? Number(diskIO.wIO_sec) : 0;
  lecturas.push({ metrica: 'DISK_READ_MBPS',  valor: Number((rSec / 1024).toFixed(2)),  unidad: 'MB/s' });
  lecturas.push({ metrica: 'DISK_WRITE_MBPS', valor: Number((wSec / 1024).toFixed(2)),  unidad: 'MB/s' });

  // CPU_TEMP_C (opcional)
  if (Number.isFinite(temp.main)) {
    lecturas.push({ metrica: 'CPU_TEMP_C', valor: Number(temp.main.toFixed(1)), unidad: '°C' });
  }

  // UPTIME_SEC (fallback a os.uptime)
  const up = Number.isFinite(time.uptime) ? Number(time.uptime) : Number(os.uptime());
  if (Number.isFinite(up)) {
    lecturas.push({ metrica: 'UPTIME_SEC', valor: Math.max(0, Math.round(up)), unidad: 's' });
  }

  // Inserta todas las lecturas en paralelo (las inserciones son independientes)
  const resultados = [];
  const poolResolved = await poolPromise;
  const insertPromises = lecturas.map(l =>
    insertLectura(poolResolved, hostId, l.metrica, l.valor, l.unidad)
      .then(id => ({ l, id }))
      .catch(err => { console.error('[captura] insertLectura error', err); return null; })
  );
  const inserted = (await Promise.all(insertPromises)).filter(Boolean);

  // Evaluar umbrales para cada lectura en paralelo
  const io = getIO();
  const evalPromises = inserted.map(item =>
    evaluarUmbrales(poolResolved, hostId, item.l.metrica, item.l.valor, item.id)
      .then(abiertas => {
        resultados.push({ ...item.l, lectura_id: item.id, alertas_abiertas: abiertas });
        // Emitir evento en tiempo real (no bloqueante)
        try {
          if (io) io.emit('nueva_lectura', {
            metrica: item.l.metrica,
            valor: item.l.valor,
            unidad: item.l.unidad,
            tomado_en: new Date().toISOString(),
            host_id: hostId
          });
        } catch (e) { /* ignore emission errors */ }
      })
      .catch(err => { console.error('[captura] evaluarUmbrales error', err); })
  );
  await Promise.all(evalPromises);

  if (process.env.DEBUG_CAPTURE === 'true') {
    console.log('[captura]', { hostId, lecturas: resultados });
  }
  return { host_id: hostId, lecturas_insertadas: resultados.length, detalles: resultados };
}

module.exports = { capturarYEvaluar };
