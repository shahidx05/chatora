const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { getConversations } = require('../controllers/conversation.controller');

const router = express.Router();
router.get('/', authMiddleware, getConversations);

module.exports = router;