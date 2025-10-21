const express = require('express');
const cors = require('cors');
require('dotenv').config();

const hardwareRoutes = require('./routes/hardware');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const auditRoutes = require('./routes/audit');
const monitorRoutes = require('./routes/monitor');
const umbralesRoutes = require('./routes/umbrales');
const reportRoutes = require('./routes/report');

const { poolPromise } = require('./db');
const scheduler = require('./utils/captureScheduler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use('/api/hardware', hardwareRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/umbrales', umbralesRoutes);
app.use('/api/report', reportRoutes);

app.get('/healthz', async (_req, res) => {
  try {
    await poolPromise;
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'db_error', error: err.message });
  }
});


const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  console.log('Cliente conectado a WebSocket');
});

module.exports.io = io;

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);

  try {
    if (String(process.env.CAPTURE_ENABLED || 'false').toLowerCase() === 'true') {
      const pool = await poolPromise;
      scheduler.setIntervalSec(Number(process.env.CAPTURE_EVERY_SEC || 60), pool);
      scheduler.start(pool);
      console.log(`[scheduler] habilitado cada ${scheduler.getStatus().intervalSec}s`);
    } else {
      console.log('[scheduler] deshabilitado (CAPTURE_ENABLED=false)');
    }
  } catch (err) {
    console.error('[scheduler] no se pudo iniciar:', err.message);
  }
});
