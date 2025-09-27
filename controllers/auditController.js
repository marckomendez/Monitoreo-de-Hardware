// /controllers/auditController.js
// Lista eventos de dimo.Bitacora con filtros y paginación.
const { sql, poolPromise } = require('../db');

/**
 * GET /api/audit/bitacora?from=ISO&to=ISO&usuario_id=1&q=texto&page=1&pageSize=20
 * Respuesta: { page, pageSize, total, items: [...] }
 */
exports.listBitacora = async (req, res) => {
  // Parámetros
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSizeReq = Math.max(1, parseInt(req.query.pageSize || '20', 10));
  const pageSize = Math.min(pageSizeReq, 100); // límite de seguridad
  const offset = (page - 1) * pageSize;

  const from = req.query.from ? new Date(req.query.from) : null;
  const to   = req.query.to   ? new Date(req.query.to)   : null;
  const usuarioId = req.query.usuario_id ? parseInt(req.query.usuario_id, 10) : null;
  const q = (req.query.q || '').trim();

  try {
    const pool = await poolPromise;
    const r = pool.request();

    // WHERE dinámico
    const where = [];
    if (from && !isNaN(from.getTime())) {
      r.input('from', sql.DateTime2, from.toISOString());
      where.push('b.creado_en >= @from');
    }
    if (to && !isNaN(to.getTime())) {
      r.input('to', sql.DateTime2, to.toISOString());
      where.push('b.creado_en < @to');
    }
    if (usuarioId) {
      r.input('usuario_id', sql.Int, usuarioId);
      where.push('b.usuario_id = @usuario_id');
    }
    if (q) {
      r.input('q', sql.NVarChar, `%${q}%`);
      // filtra por acción o detalle
      where.push('(b.accion LIKE @q OR b.detalle LIKE @q)');
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // total
    const rsCount = await r.query(`
      SELECT COUNT(*) AS total
      FROM dimo.Bitacora b
      ${whereSql}
    `);
    const total = rsCount.recordset[0]?.total || 0;

    // página
    const r2 = pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize);

    // reinyecta parámetros del primer request
    if (r.parameters.from)       r2.input('from',       sql.DateTime2, r.parameters.from.value);
    if (r.parameters.to)         r2.input('to',         sql.DateTime2, r.parameters.to.value);
    if (r.parameters.usuario_id) r2.input('usuario_id', sql.Int,       r.parameters.usuario_id.value);
    if (r.parameters.q)          r2.input('q',          sql.NVarChar,  r.parameters.q.value);

    const rs = await r2.query(`
      SELECT
        b.id,
        b.usuario_id,
        u.nombre   AS usuario_nombre,
        u.email    AS usuario_email,
        b.accion,
        b.detalle,
        b.creado_en
      FROM dimo.Bitacora b
      LEFT JOIN dimo.Usuario u ON u.id = b.usuario_id
      ${whereSql}
      ORDER BY b.creado_en DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    res.json({ page, pageSize, total, items: rs.recordset });
  } catch (err) {
    console.error('listBitacora:', err);
    res.status(500).json({ error: 'Error al consultar bitácora', detalle: err.message });
  }
};