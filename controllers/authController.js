const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            database: process.env.DB_NAME,
            options: { encrypt: false, trustServerCertificate: true }
        });
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM dimo.Usuario WHERE email = @email');
        if (result.recordset.length === 0) {
            console.log('Usuario no encontrado:', email);
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        const user = result.recordset[0];
        const validPass = await bcrypt.compare(password, user.hash);
        if (!validPass) {
            console.log('Contraseña incorrecta para:', email);
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, rol_id: user.rol_id }, process.env.JWT_SECRET || 'secreto', { expiresIn: '2h' });
        res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, estado: user.estado, rol_id: user.rol_id } });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error en el servidor', detalle: err.message });
    }
};
