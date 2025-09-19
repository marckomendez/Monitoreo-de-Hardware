exports.eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        // Obtener datos del usuario antes de eliminar
        const usuario = await pool.request().input('id', sql.Int, id).query('SELECT nombre, email FROM dimo.Usuario WHERE id = @id');
        await pool.request().input('id', sql.Int, id).query('DELETE FROM dimo.Usuario WHERE id = @id');
        if (usuario.recordset.length > 0) {
            await registrarBitacora(id, 'ELIMINAR', `Usuario eliminado: ${usuario.recordset[0].nombre} (${usuario.recordset[0].email})`);
        }
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ error: 'Error al eliminar usuario', detalle: err.message });
    }
};
const sql = require('mssql');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function registrarBitacora(usuario_id, accion, detalle) {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .input('accion', sql.NVarChar, accion)
            .input('detalle', sql.NVarChar, detalle)
            .query('INSERT INTO dimo.Bitacora(usuario_id, accion, detalle, creado_en) VALUES (@usuario_id, @accion, @detalle, GETDATE())');
    } catch (err) {
        console.error('Error al registrar en bitácora:', err.message);
    }
}

exports.listarUsuarios = async (req, res) => {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
    const result = await pool.request().query('SELECT id, nombre, email, rol_id, estado FROM dimo.Usuario');
        console.log('Usuarios encontrados:', result.recordset);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al listar usuarios:', err);
        res.status(500).json({ error: 'Error al listar usuarios', detalle: err.message });
    }
};

exports.crearUsuario = async (req, res) => {
    const { nombre, email, rol_id, password } = req.body;
    try {
        console.log('Intentando crear usuario:', { nombre, email, rol_id });
        const hash = await bcrypt.hash(password, 10);
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        console.log('Conexión a SQL Server exitosa');
        const result = await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('email', sql.NVarChar, email)
            .input('hash', sql.NVarChar, hash)
            .input('rol_id', sql.Int, rol_id)
            .query("INSERT INTO dimo.Usuario(nombre, email, hash, estado, rol_id) OUTPUT INSERTED.id VALUES (@nombre, @email, @hash, 'ACTIVO', @rol_id)");
        console.log('Resultado de inserción:', result);
        const nuevoId = result.recordset[0].id;
        await registrarBitacora(nuevoId, 'CREAR', `Usuario creado: ${nombre} (${email})`);
        res.json({ mensaje: 'Usuario creado correctamente' });
    } catch (err) {
        console.error('Error al crear usuario:', err);
        res.status(500).json({ error: 'Error al crear usuario', detalle: err.message });
    }
};

exports.editarUsuario = async (req, res) => {
    const { nombre, email, rol_id } = req.body;
    const { id } = req.params;
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.NVarChar, nombre)
            .input('email', sql.NVarChar, email)
            .input('rol_id', sql.Int, rol_id)
            .query('UPDATE dimo.Usuario SET nombre=@nombre, email=@email, rol_id=@rol_id WHERE id=@id');
        await registrarBitacora(id, 'EDITAR', `Usuario editado: ${nombre} (${email})`);
        res.json({ mensaje: 'Usuario actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al editar usuario', detalle: err.message });
    }
};

exports.cambiarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        await pool.request()
            .input('id', sql.Int, id)
            .input('estado', sql.NVarChar, estado)
            .query('UPDATE dimo.Usuario SET estado=@estado WHERE id=@id');
        await registrarBitacora(id, 'CAMBIAR_ESTADO', `Usuario ${id} cambiado a estado: ${estado}`);
        res.json({ mensaje: 'Estado actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cambiar estado', detalle: err.message });
    }
};

exports.resetearPassword = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        await pool.request()
            .input('id', sql.Int, id)
            .input('hash', sql.NVarChar, hash)
            .query('UPDATE dimo.Usuario SET hash=@hash WHERE id=@id');
        await registrarBitacora(id, 'RESETEAR_PASSWORD', `Contraseña reseteada para usuario ${id}`);
        res.json({ mensaje: 'Contraseña reseteada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al resetear contraseña', detalle: err.message });
    }
};
