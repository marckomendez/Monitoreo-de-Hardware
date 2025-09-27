// /routes/umbrales.js
const express = require('express');
const router = express.Router();
const ctl = require('../controllers/umbralesController');
const { requireAuth, requireRole, Roles } = require('../middlewares/authMiddleware');

// Solo ADMIN
router.use(requireAuth);
router.use(requireRole(Roles.ADMIN, 'ADMIN'));

router.get('/', ctl.listar);
router.get('/:id', ctl.obtener);
router.post('/', ctl.crear);
router.put('/:id', ctl.actualizar);
router.delete('/:id', ctl.eliminar);

module.exports = router;
