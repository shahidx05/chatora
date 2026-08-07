const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const groupController = require('../controllers/group.controller');

const router = express.Router();

router.post('/', authMiddleware, groupController.createGroup);
router.put('/:groupId', authMiddleware, groupController.updateGroup); 
router.put('/:groupId/add', authMiddleware, groupController.addMembers);
router.put('/:groupId/remove', authMiddleware, groupController.removeMember);
router.put('/:groupId/admin', authMiddleware, groupController.manageAdmin);
router.put('/:groupId/leave', authMiddleware, groupController.leaveGroup);
module.exports = router;