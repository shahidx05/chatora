const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const uploadController = require('../controllers/upload.controller');

const router = express.Router();

router.post('/sign', authMiddleware, uploadController.signUpload);

module.exports = router;
