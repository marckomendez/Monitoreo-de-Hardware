// /controllers/reportesController.js
const { sql, poolPromise } = require('../db');

/**
 * GET /api/report/lecturas?metrica=CPU_TEMP_C&from=2025-09-22T00:00:00Z&to=2025-09-23T00:00:00Z&host_id=1
 * Devuelve series temporales de lecturas (ordenadas por tomado_en ASC).
 * Si no se envían fechas, usa último 1 día.
 */
exports.lecturas = async (req, res) => {
  const metrica = (req.query.metrica || '').trim();
  if (!metrica) return res.status(400).json({ error: 'Parámetro "metrica" es requerido' });

  // Rango por defecto: últimas 24h (UTC)
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 24 * 3600 * 1000);
  const hostId = req.query.host_id ? parseInt(req.query.host_id, 10) : null;

  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
    return res.status(400).json({ error: 'Rango de fechas inválido' });
  }

  try {
    const pool = await poolPromise;
    const reqSql = pool.request()
      .input('metrica', sql.NVarChar, metrica)
      .input('from', sql.DateTime2, from.toISOString())
      .input('to', sql.DateTime2, to.toISOString());

    let where = 'l.metrica = @metrica AND l.tomado_en >= @from AND l.tomado_en < @to';
    if (hostId) {
      reqSql.input('host_id', sql.Int, hostId);
      where += ' AND l.host_id = @host_id';
    }

    const rs = await reqSql.query(`
      SELECT l.host_id, l.metrica, l.valor, l.unidad, l.tomado_en
      FROM dimo.Lectura l
      WHERE ${where}
      ORDER BY l.tomado_en ASC
    `);

    res.json({
      metrica,
      from: from.toISOString(),
      to: to.toISOString(),
      host_id: hostId,
      puntos: rs.recordset
    });
  } catch (err) {
    console.error('report lecturas:', err);
    res.status(500).json({ error: 'Error al consultar lecturas', detalle: err.message });
  }
};

/**
 * GET /api/report/alertas/resumen?from=...&to=...&estado=ABIERTA|CERRADA|TODAS
 * Devuelve agregados: por severidad, por métrica y serie por día.
 */
exports.alertasResumen = async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 24 * 3600 * 1000); // 30 días
  const estado = (req.query.estado || 'TODAS').toUpperCase();

  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
    return res.status(400).json({ error: 'Rango de fechas inválido' });
  }

  try {
    const pool = await poolPromise;

    const baseReq = pool.request()
      .input('from', sql.DateTime2, from.toISOString())
      .input('to', sql.DateTime2, to.toISOString());

    let where = 'a.creado_en >= @from AND a.creado_en < @to';
    if (['ABIERTA', 'CERRADA'].includes(estado)) {
      baseReq.input('estado', sql.NVarChar, estado);
      where += ' AND a.estado = @estado';
    }

    // Por severidad
    const porSeveridad = await baseReq.query(`
      SELECT a.severidad, COUNT(*) AS total
      FROM dimo.Alerta a
      WHERE ${where}
      GROUP BY a.severidad
    `);

    // Por métrica
    const porMetrica = await baseReq.query(`
      SELECT u.metrica, COUNT(*) AS total
      FROM dimo.Alerta a
      JOIN dimo.Umbral u ON u.id = a.umbral_id
      WHERE ${where}
      GROUP BY u.metrica
      ORDER BY total DESC
    `);

    // Serie por día
    const serie = await baseReq.query(`
      SELECT CONVERT(date, a.creado_en) AS dia, COUNT(*) AS total
      FROM dimo.Alerta a
      WHERE ${where}
      GROUP BY CONVERT(date, a.creado_en)
      ORDER BY dia ASC
    `);

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      estado,
      porSeveridad: porSeveridad.recordset,
      porMetrica: porMetrica.recordset,
      serie: serie.recordset
    });
  } catch (err) {
    console.error('report alertas resumen:', err);
    res.status(500).json({ error: 'Error al consultar resumen de alertas', detalle: err.message });
  }
};
