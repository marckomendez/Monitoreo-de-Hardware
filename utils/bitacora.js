// /utils/bitacora.js
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../db');
require('dotenv').config();

function actorIdFromReq(req) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    const token = h.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id ?? null;
  } catch {
    return null;
  }
}

async function registrar(req, accion, detalle) {
  const userId = actorIdFromReq(req);
  if (!userId) return; // evita romper FK si la acción no viene autenticada
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('usuario_id', sql.Int, userId)
      .input('accion', sql.NVarChar, accion)
      .input('detalle', sql.NVarChar, detalle)
      .query(`
        INSERT INTO dimo.Bitacora(usuario_id, accion, detalle, creado_en)
        VALUES (@usuario_id, @accion, @detalle, SYSUTCDATETIME())
      `);
  } catch (err) {
    console.error('Bitácora error:', err.message);
  }
}

module.exports = { registrar, actorIdFromReq };
