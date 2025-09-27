// /controllers/monitorController.js
const { sql, poolPromise } = require('../db');
const { capturarYEvaluar } = require('../utils/monitor');
const scheduler = require('../utils/captureScheduler');

// --- Captura manual ---
exports.capturar = async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await capturarYEvaluar(pool);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('capturar:', err);
    res.status(500).json({ error: 'Error al capturar/evaluar', detalle: err.message });
  }
};

// --- Listado de alertas ---
exports.alertas = async (req, res) => {
  const estado = (req.query.estado || 'ABIERTA').toUpperCase();
  const hostId = req.query.host_id ? parseInt(req.query.host_id, 10) : null;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    let where = '1=1';
    if (['ABIERTA', 'CERRADA'].includes(estado)) {
      request.input('estado', sql.NVarChar, estado);
      where += ' AND a.estado = @estado';
    }
    if (hostId) {
      request.input('host_id', sql.Int, hostId);
      where += ' AND a.host_id = @host_id';
    }

    const rs = await request.query(`
      SELECT
        a.id, a.host_id, a.umbral_id, a.lectura_id,
        a.severidad, a.estado, a.comentario_cierre, a.cerrado_por,
        a.creado_en, a.cerrado_en,
        u.metrica, u.operador, u.valor AS umbral_valor,
        l.valor AS lectura_valor, l.unidad, l.tomado_en
      FROM dimo.Alerta a
      JOIN dimo.Umbral u ON u.id = a.umbral_id
      LEFT JOIN dimo.Lectura l ON l.id = a.lectura_id
      WHERE ${where}
      ORDER BY a.creado_en DESC
    `);

    res.json(rs.recordset);
  } catch (err) {
    console.error('alertas:', err);
    res.status(500).json({ error: 'Error al listar alertas', detalle: err.message });
  }
};

// --- Cerrar alerta ---
exports.cerrarAlerta = async (req, res) => {
  const { id } = req.params;
  const { comentario } = req.body || {};
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('comentario', sql.NVarChar, comentario || null)
      .input('cerrado_por', sql.Int, req.user?.id || null)
      .query(`
        UPDATE dimo.Alerta
        SET estado = N'CERRADA',
            comentario_cierre = @comentario,
            cerrado_por = @cerrado_por,
            cerrado_en = SYSUTCDATETIME()
        WHERE id = @id AND estado = N'ABIERTA'
      `);
    res.json({ mensaje: 'Alerta cerrada (si estaba abierta).' });
  } catch (err) {
    console.error('cerrarAlerta:', err);
    res.status(500).json({ error: 'Error al cerrar alerta', detalle: err.message });
  }
};

// --- Hosts (para UI de reportes) ---
exports.hosts = async (_req, res) => {
  try {
    const pool = await poolPromise;
    const rs = await pool.request().query(`
      SELECT id, nombre
      FROM dimo.Host
      ORDER BY id
    `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('hosts:', err);
    res.status(500).json({ error: 'Error al listar hosts', detalle: err.message });
  }
};

// --- Scheduler: status / enable / disable / config (solo ADMIN; el router valida) ---
exports.schedulerStatus = (_req, res) => res.json(scheduler.getStatus());

exports.schedulerEnable = async (_req, res) => {
  try {
    const pool = await poolPromise;
    res.json(scheduler.start(pool));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo iniciar el scheduler', detalle: err.message });
  }
};

exports.schedulerDisable = (_req, res) => res.json(scheduler.stop());

exports.schedulerConfig = async (req, res) => {
  const { intervalSec } = req.body || {};
  if (!intervalSec || isNaN(Number(intervalSec))) {
    return res.status(400).json({ error: 'intervalSec inválido' });
  }
  try {
    const pool = await poolPromise;
    res.json(scheduler.setIntervalSec(Number(intervalSec), pool));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo reconfigurar el scheduler', detalle: err.message });
  }
};
exports.testInsert = async (_req, res) => {
  try {
    const pool = await poolPromise;
    const hostId = await (async () => {
      // reusa ensureHost de monitor.js de forma simple:
      const { capturarYEvaluar } = require('../utils/monitor');
      // Hacemos una captura normal y devolvemos el detalle
      const r = await capturarYEvaluar(pool);
      return res.json({ ok: true, ...r });
    })();
  } catch (err) {
    console.error('testInsert:', err);
    res.status(500).json({ error: 'Fallo en testInsert', detalle: err.message });
  }
};