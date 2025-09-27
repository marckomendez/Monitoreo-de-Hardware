// /routes/hardware.js
const express = require('express');
const router = express.Router();
const hardwareController = require('../controllers/hardwareController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Si querés que cualquiera acceda, comentá la línea siguiente
//router.use(requireAuth);

router.get('/', hardwareController.getHardwareInfo);
router.get('/temp', hardwareController.getCPUTemp);
router.get('/uptime', hardwareController.getUptime);
router.get('/diskspeed', hardwareController.getDiskSpeed);

module.exports = router;
