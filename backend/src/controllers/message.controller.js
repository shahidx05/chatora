const Message = require('../models/Message');

exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

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
