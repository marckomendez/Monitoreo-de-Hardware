const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../db');
const { registrar } = require('../utils/bitacora');
require('dotenv').config();

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT TOP 1 id, nombre, email, hash, estado, rol_id
        FROM dimo.Usuario
        WHERE email = @email AND estado = N'ACTIVO'
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.recordset[0];
    const validPass = await bcrypt.compare(password, user.hash);
    if (!validPass) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol_id: user.rol_id },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Registro de auditoría (login exitoso)
    // Importante: se registra después de emitir el token para que el req ya pueda decodificar al actor
    req.headers.authorization = `Bearer ${token}`; // permite a bitácora identificar al actor
    await registrar(req, 'LOGIN', 'Inicio de sesión');

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, estado: user.estado, rol_id: user.rol_id }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor', detalle: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query(`
        SELECT id, nombre, email, estado, rol_id
        FROM dimo.Usuario
        WHERE id = @id
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ error: 'Error en el servidor', detalle: err.message });
  }
};