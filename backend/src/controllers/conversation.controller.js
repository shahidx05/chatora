const Conversation = require('../models/Conversation');

exports.getConversations = async (req, res) => {
    try {
        console.log(req.user);
        const userId = req.user.id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', '-password')
            .populate('groupAdmins', '-password') 
            .populate({ path: 'lastMessage', select: 'content sender status createdAt type isSystemMessage' })
            .sort({ updatedAt: -1 });

        const result = conversations.map(conversation => {
            if (conversation.isGroup) {
                return {
                    _id: conversation._id,
                    isGroupChat: true,
                    groupName: conversation.groupName,
                    groupDescription: conversation.groupDescription || "",
                    groupAdmins: conversation.groupAdmins || [],
                    participants: conversation.participants || [],
                    lastMessage: conversation.lastMessage,
                    unreadCount: conversation.unreadCount.get(userId.toString()) || 0
                };
            }
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
            userId,
            conversations: result
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};