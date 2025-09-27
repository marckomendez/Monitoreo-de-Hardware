// /routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.post('/login', authController.login);

router.get('/me', requireAuth, authController.me);

module.exports = router;
