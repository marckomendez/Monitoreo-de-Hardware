// /routes/audit.js
const express = require('express');
const router = express.Router();
const ctl = require('../controllers/auditController');
const { requireAuth, requireRole, Roles } = require('../middlewares/authMiddleware');

router.use(requireAuth);

// Permite ver bitácora a ADMIN y TECNICO
router.get('/bitacora',
  requireRole(Roles.ADMIN, Roles.TECNICO, 'ADMIN', 'TECNICO'),
  ctl.listBitacora
);

module.exports = router;