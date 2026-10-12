const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation' });
        }

        const isMember = await Conversation.exists({
            _id: conversationId,
            participants: req.user.id
        });
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', '-password')
            .sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
