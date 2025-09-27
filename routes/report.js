// /routes/report.js
const express = require('express');
const router = express.Router();
const ctl = require('../controllers/reportesController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Cualquier usuario autenticado puede consultar reportes
router.use(requireAuth);

router.get('/lecturas', ctl.lecturas);
router.get('/alertas/resumen', ctl.alertasResumen);

module.exports = router;
