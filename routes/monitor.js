// /routes/monitor.js
const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitorController');
const { requireAuth, requireRole, Roles } = require('../middlewares/authMiddleware');
// después de las otras rutas:
router.get('/test-insert',
  requireRole(Roles.ADMIN, 'ADMIN'),
  monitorController.testInsert
);


router.use(requireAuth);

// Captura & alertas
router.get('/capturar', monitorController.capturar);
router.get('/alertas', monitorController.alertas);
router.patch('/alertas/:id/cerrar',
  requireRole(Roles.ADMIN, Roles.TECNICO, 'ADMIN', 'TECNICO'),
  monitorController.cerrarAlerta
);

// Hosts (para autocompletar en reportes)
router.get('/hosts', monitorController.hosts);

// Scheduler (solo ADMIN)
router.get('/scheduler/status',
  requireRole(Roles.ADMIN, 'ADMIN'),
  monitorController.schedulerStatus
);
router.post('/scheduler/enable',
  requireRole(Roles.ADMIN, 'ADMIN'),
  monitorController.schedulerEnable
);
router.post('/scheduler/disable',
  requireRole(Roles.ADMIN, 'ADMIN'),
  monitorController.schedulerDisable
);
router.put('/scheduler/config',
  requireRole(Roles.ADMIN, 'ADMIN'),
  monitorController.schedulerConfig
);

module.exports = router;