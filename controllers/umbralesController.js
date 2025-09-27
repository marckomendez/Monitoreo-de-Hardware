// /controllers/umbralesController.js
const { sql, poolPromise } = require('../db');
const { registrar } = require('../utils/bitacora');

function isValidOperador(op) {
  return ['>', '>=', '<', '<='].includes(String(op));
}
function isValidSeveridad(s) {
  return ['ADVERTENCIA', 'CRITICA'].includes(String(s || '').toUpperCase());
}

// GET /api/umbrales?metrica=CPU_TEMP_C
exports.listar = async (req, res) => {
  const metrica = (req.query.metrica || '').trim();
  try {
    const pool = await poolPromise;
    const request = pool.request();
    let where = '1=1';
    if (metrica) {
      request.input('metrica', sql.NVarChar, metrica);
      where += ' AND u.metrica = @metrica';
    }
    const rs = await request.query(`
      SELECT
        u.id, u.metrica, u.operador, u.valor, u.severidad,
        u.creado_por, u.creado_en,
        usr.nombre AS creado_por_nombre, usr.email AS creado_por_email
      FROM dimo.Umbral u
      LEFT JOIN dimo.Usuario usr ON usr.id = u.creado_por
      WHERE ${where}
      ORDER BY u.creado_en DESC, u.id DESC
    `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('listar umbrales:', err);
    res.status(500).json({ error: 'Error al listar umbrales', detalle: err.message });
  }
};

// GET /api/umbrales/:id
exports.obtener = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          u.id, u.metrica, u.operador, u.valor, u.severidad,
          u.creado_por, u.creado_en
        FROM dimo.Umbral u
        WHERE u.id = @id
      `);
    if (rs.recordset.length === 0) return res.status(404).json({ error: 'Umbral no encontrado' });
    res.json(rs.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener umbral', detalle: err.message });
  }
};

// POST /api/umbrales
exports.crear = async (req, res) => {
  const { metrica, operador, valor, severidad } = req.body || {};
  const creadorId = req.user?.id; // requireAuth garantiza esto
  try {
    if (!metrica || !operador || valor === undefined || valor === null || !severidad) {
      return res.status(400).json({ error: 'Campos incompletos' });
    }
    if (!isValidOperador(operador)) return res.status(400).json({ error: 'Operador inválido' });
    if (!isValidSeveridad(severidad)) return res.status(400).json({ error: 'Severidad inválida' });

    const pool = await poolPromise;
    const rs = await pool.request()
      .input('metrica', sql.NVarChar, metrica)
      .input('operador', sql.NVarChar, operador)
      .input('valor', sql.Decimal(12, 2), Number(valor))
      .input('severidad', sql.NVarChar, severidad.toUpperCase())
      .input('creado_por', sql.Int, creadorId)
      .query(`
        INSERT INTO dimo.Umbral (metrica, operador, valor, severidad, creado_por, creado_en)
        OUTPUT INSERTED.id
        VALUES (@metrica, @operador, @valor, @severidad, @creado_por, SYSUTCDATETIME())
      `);

    const nuevoId = rs.recordset[0].id;
    await registrar(req, 'CREAR_UMBRAL', `Métrica=${metrica} ${operador} ${valor} sev=${severidad}`);
    res.json({ mensaje: 'Umbral creado', id: nuevoId });
  } catch (err) {
    console.error('crear umbral:', err);
    res.status(500).json({ error: 'Error al crear umbral', detalle: err.message });
  }
};

// PUT /api/umbrales/:id
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { metrica, operador, valor, severidad } = req.body || {};
  try {
    if (!metrica || !operador || valor === undefined || valor === null || !severidad) {
      return res.status(400).json({ error: 'Campos incompletos' });
    }
    if (!isValidOperador(operador)) return res.status(400).json({ error: 'Operador inválido' });
    if (!isValidSeveridad(severidad)) return res.status(400).json({ error: 'Severidad inválida' });

    const pool = await poolPromise;
    const rs = await pool.request()
      .input('id', sql.Int, id)
      .input('metrica', sql.NVarChar, metrica)
      .input('operador', sql.NVarChar, operador)
      .input('valor', sql.Decimal(12, 2), Number(valor))
      .input('severidad', sql.NVarChar, severidad.toUpperCase())
      .query(`
        UPDATE dimo.Umbral
        SET metrica=@metrica, operador=@operador, valor=@valor, severidad=@severidad
        WHERE id=@id
      `);

    if (rs.rowsAffected[0] === 0) return res.status(404).json({ error: 'Umbral no encontrado' });
    await registrar(req, 'EDITAR_UMBRAL', `#${id} → ${metrica} ${operador} ${valor} sev=${severidad}`);
    res.json({ mensaje: 'Umbral actualizado' });
  } catch (err) {
    console.error('actualizar umbral:', err);
    res.status(500).json({ error: 'Error al actualizar umbral', detalle: err.message });
  }
};

// DELETE /api/umbrales/:id
exports.eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    try {
      const rs = await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM dimo.Umbral WHERE id=@id`);

      if (rs.rowsAffected[0] === 0) return res.status(404).json({ error: 'Umbral no encontrado' });
      await registrar(req, 'ELIMINAR_UMBRAL', `#${id}`);
      return res.json({ mensaje: 'Umbral eliminado' });
    } catch (err) {
      // 547 = conflicto por FK (alertas existentes)
      if (err.number === 547) {
        return res.status(409).json({ error: 'No se puede eliminar: umbral está referenciado por alertas.' });
      }
      throw err;
    }
  } catch (err) {
    console.error('eliminar umbral:', err);
    res.status(500).json({ error: 'Error al eliminar umbral', detalle: err.message });
  }
};