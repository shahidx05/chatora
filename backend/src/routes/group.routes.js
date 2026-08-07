const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const groupController = require('../controllers/group.controller');

const router = express.Router();

router.post('/', authMiddleware, groupController.createGroup);

module.exports = router;