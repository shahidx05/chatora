const Conversation = require('../models/Conversation');

exports.getConversations = async (req, res) => {
    try {
        const userId = req.userId;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', '-password')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        const result = conversations.map(conversation => {
            const participant = conversation.participants.find(
                user => String(user._id) !== String(userId)
            );

            return {
                _id: conversation._id,
                participant,
                lastMessage: conversation.lastMessage,
                unreadCount: conversation.unreadCount.get(userId.toString()) || 0
            };
        });

        res.status(200).json({
            success: true,
            conversations: result
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};