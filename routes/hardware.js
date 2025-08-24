const express = require('express');
const router = express.Router();
const hardwareController = require('../controllers/hardwareController');

router.get('/', hardwareController.getHardwareInfo);
router.get('/temp', hardwareController.getCPUTemp);
router.get('/uptime', hardwareController.getUptime);
router.get('/diskspeed', hardwareController.getDiskSpeed);

module.exports = router;
