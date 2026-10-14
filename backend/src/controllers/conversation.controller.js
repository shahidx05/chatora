const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', '-password')
            .populate('groupAdmins', '-password')
            // populate lastMessage, but we may need to replace it per-user below
            .populate({ path: 'lastMessage', select: 'content sender status createdAt type isSystemMessage deletedFor isDeleted' })
            .sort({ updatedAt: -1 });

        // For each conversation, if the global lastMessage is in the requesting
        // user's deletedFor list, find the most-recent message still visible to them.
        const result = await Promise.all(conversations.map(async (conversation) => {
            let lastMsg = conversation.lastMessage;

            // Replace lastMessage if it is hidden from this user (deleted-for-me)
            if (
                lastMsg &&
                !lastMsg.isDeleted &&                        // deleted-for-everyone stays visible as placeholder
                Array.isArray(lastMsg.deletedFor) &&
                lastMsg.deletedFor.some(id => String(id) === String(userId))
            ) {
                // Find the newest message still visible to this user
                const fallback = await Message.findOne({
                    conversation: conversation._id,
                    deletedFor: { $ne: userId },
                    isDeleted: { $ne: true }
                })
                    .sort({ _id: -1 })
                    .select('content sender status createdAt type isSystemMessage')
                    .lean();
                lastMsg = fallback || null;
            } else if (lastMsg) {
                // Strip deletedFor before sending to client
                const obj = lastMsg.toObject ? lastMsg.toObject() : { ...lastMsg };
                // eslint-disable-next-line no-unused-vars
                const { deletedFor: _df, ...safeLastMsg } = obj;
                lastMsg = safeLastMsg;
            }

            if (conversation.isGroup) {
                return {
                    _id: conversation._id,
                    isGroupChat: true,
                    groupName: conversation.groupName,
                    groupDescription: conversation.groupDescription || '',
                    groupAdmins: conversation.groupAdmins || [],
                    participants: conversation.participants || [],
                    lastMessage: lastMsg,
                    unreadCount: conversation.unreadCount.get(userId.toString()) || 0
                };
            }

            const participant = conversation.participants.find(
                user => String(user._id) !== String(userId)
            );

            return {
                _id: conversation._id,
                participant,
                lastMessage: lastMsg,
                unreadCount: conversation.unreadCount.get(userId.toString()) || 0
            };
        }));

        res.status(200).json({
            success: true,
            userId,
            conversations: result
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};