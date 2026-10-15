const express = require('express')
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware')
const authController = require('../controllers/auth.controller');
const rateLimit = require('../middleware/rateLimit.middleware');

router.post('/register', rateLimit({ name: 'register', limit: 5, windowSec: 3600 }), authController.register);
router.post('/login', rateLimit({ name: 'login', limit: 10, windowSec: 900 }), authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router