// db.js
const sql = require('mssql');
require('dotenv').config();

const cfg = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

if (process.env.DB_INSTANCE && process.env.DB_INSTANCE.trim() !== '') {
  cfg.options.instanceName = process.env.DB_INSTANCE.trim();
} else if (process.env.DB_PORT && String(process.env.DB_PORT).trim() !== '') {
  cfg.port = parseInt(process.env.DB_PORT, 10);
}

const poolPromise = new sql.ConnectionPool(cfg)
  .connect()
  .then(pool => {
    console.log('Pool SQL Server listo');
    return pool;
  })
  .catch(err => {
    console.error('Error al conectar al SQL Server:', err.message);
    throw err;
  });

sql.on('error', err => {
  console.error('SQL global error:', err);
});

module.exports = { sql, poolPromise };
