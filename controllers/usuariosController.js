const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('../db');
const { registrar } = require('../utils/bitacora');
require('dotenv').config();

exports.listarUsuarios = async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT id, nombre, email, rol_id, estado FROM dimo.Usuario ORDER BY id DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    res.status(500).json({ error: 'Error al listar usuarios', detalle: err.message });
  }
};

exports.crearUsuario = async (req, res) => {
  const { nombre, email, rol_id, password } = req.body;
  try {
    if (!nombre || !email || !rol_id || !password) {
      return res.status(400).json({ error: 'Campos incompletos' });
    }
    const hash = await bcrypt.hash(password, 10);
    const pool = await poolPromise;
    const result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('hash', sql.NVarChar, hash)
      .input('rol_id', sql.Int, rol_id)
      .query(`
        INSERT INTO dimo.Usuario(nombre, email, hash, estado, rol_id)
        OUTPUT INSERTED.id
        VALUES (@nombre, @email, @hash, N'ACTIVO', @rol_id)
      `);
    const nuevoId = result.recordset[0].id;
    await registrar(req, 'CREAR_USUARIO', `Usuario creado: ${nombre} (${email})`);
    res.json({ mensaje: 'Usuario creado correctamente', id: nuevoId });
  } catch (err) {
    if ([2601, 2627].includes(err.number)) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario', detalle: err.message });
  }
};

exports.editarUsuario = async (req, res) => {
  const { nombre, email, rol_id } = req.body;
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('rol_id', sql.Int, rol_id)
      .query(`
        UPDATE dimo.Usuario
        SET nombre=@nombre, email=@email, rol_id=@rol_id
        WHERE id=@id
      `);
    await registrar(req, 'EDITAR_USUARIO', `Usuario editado: ${nombre} (${email})`);
    res.json({ mensaje: 'Usuario actualizado correctamente' });
  } catch (err) {
    if ([2601, 2627].includes(err.number)) {
      return res.status(409).json({ error: 'El email ya está registrado por otro usuario' });
    }
    res.status(500).json({ error: 'Error al editar usuario', detalle: err.message });
  }
};

exports.cambiarEstadoUsuario = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'ACTIVO' o 'INACTIVO'
  try {
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('estado', sql.NVarChar, estado)
      .query('UPDATE dimo.Usuario SET estado=@estado WHERE id=@id');
    await registrar(req, 'CAMBIAR_ESTADO_USUARIO', `Usuario ${id} → ${estado}`);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado', detalle: err.message });
  }
};

exports.resetearPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  try {
    if (!password) return res.status(400).json({ error: 'Password requerido' });
    const hash = await bcrypt.hash(password, 10);
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('hash', sql.NVarChar, hash)
      .query('UPDATE dimo.Usuario SET hash=@hash WHERE id=@id');
    await registrar(req, 'RESETEAR_PASSWORD', `Password reseteado para usuario ${id}`);
    res.json({ mensaje: 'Contraseña reseteada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al resetear contraseña', detalle: err.message });
  }
};

/**
 * Eliminar usuario:
 * - Intenta DELETE.
 * - Si hay conflicto de FK (547), hace soft delete: estado='INACTIVO'.
 * - Con ?force=true, además anonimiza email/nombre.
 */
exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  const force = String(req.query.force || '').toLowerCase() === 'true';
  try {
    const pool = await poolPromise;

    const usuario = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT nombre, email FROM dimo.Usuario WHERE id = @id');

    try {
      await pool.request().input('id', sql.Int, id)
        .query('DELETE FROM dimo.Usuario WHERE id = @id');

      if (usuario.recordset.length > 0) {
        const { nombre, email } = usuario.recordset[0];
        await registrar(req, 'ELIMINAR_USUARIO', `Usuario eliminado: ${nombre} (${email})`);
      }
      return res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (err) {
      if (err.number === 547) { // conflicto con FK bitácora
        if (force) {
          await pool.request()
            .input('id', sql.Int, id)
            .query(`
              UPDATE dimo.Usuario
              SET estado = N'INACTIVO',
                  email  = CONCAT(email, N'.deleted.', CAST(id AS NVARCHAR(12))),
                  nombre = CONCAT(N'[ELIMINADO] ', nombre)
              WHERE id = @id
            `);
          await registrar(req, 'ANONIMIZAR_USUARIO', `Usuario desactivado y anonimizado (posee bitácora): ${id}`);
          return res.json({ mensaje: 'Usuario desactivado y anonimizado (conserva auditoría).', softDelete: true, anonymized: true });
        } else {
          await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE dimo.Usuario SET estado = N'INACTIVO' WHERE id = @id`);
          await registrar(req, 'DESACTIVAR_USUARIO', `Usuario desactivado (posee bitácora): ${id}`);
          return res.json({ mensaje: 'Usuario desactivado (posee registros en bitácora).', softDelete: true });
        }
      }
      throw err;
    }
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario', detalle: err.message });
  }
};
