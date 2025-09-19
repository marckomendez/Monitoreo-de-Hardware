const express = require('express');
const cors = require('cors');
const hardwareRoutes = require('./routes/hardware');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const sql = require('mssql');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use('/api/hardware', hardwareRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function probarConexion() {
    try {
        await sql.connect(dbConfig);
        console.log('Conexión a SQL Server exitosa');
    } catch (err) {
        console.error('Error de conexión a SQL Server:', err.message);
    }
}

probarConexion();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
