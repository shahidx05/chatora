const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const { isOnline } = require('../onlineUsers');

const isParticipant = (conversation, userId) =>
    conversation.participants.some(p => p.equals(userId));

const registerMessageHandlers = (io, socket) => {
    socket.on('send_message', async (data) => {
        try {
            const senderId = socket.user._id;
            const content = typeof data?.message === 'string' ? data.message.trim() : '';
            if (!content || content.length > 5000) return;

            let conversation;
            if (data.conversationId) {
                conversation = await Conversation.findById(data.conversationId);
            } else if (data.receiver) {
                conversation = await Conversation.findOne({
                    isGroup: false,
                    participants: { $all: [senderId, data.receiver] },
                    $expr: { $eq: [{ $size: "$participants" }, 2] }
                });
                if (!conversation) {
                    conversation = await Conversation.create({
                        isGroup: false,
                        participants: [senderId, data.receiver]
                    });
                }
            }

            if (!conversation || !isParticipant(conversation, senderId)) return;

            let initialStatus = "sent";
            let otherUserId = null;
            if (!conversation.isGroup) {
                otherUserId = conversation.participants.find(p => !p.equals(senderId));
                if (otherUserId && await isOnline(otherUserId.toString())) {
                    initialStatus = "delivered";
                }
            }

            const message = await Message.create({
                conversation: conversation._id,
                sender: senderId,
                receiver: data.receiver || null,
                content,
                status: initialStatus,
                readBy: [senderId]
            });

            // atomic update: no lost counts when messages arrive together
            const update = { $set: { lastMessage: message._id } };
            const inc = {};
            for (const p of conversation.participants) {
                if (!p.equals(senderId)) inc[`unreadCount.${p}`] = 1;
            }
            if (Object.keys(inc).length) update.$inc = inc;
            await Conversation.updateOne({ _id: conversation._id }, update);

            const messagePayload = {
                _id: message._id,
                conversation: message.conversation,
                sender: { _id: senderId, name: socket.user.name },
                receiver: message.receiver,
                content: message.content,
                status: message.status,
                readBy: message.readBy,
                createdAt: message.createdAt
            };

            for (const participantId of conversation.participants) {
                io.to(participantId.toString()).emit('receive_message', messagePayload);
            }

            if (otherUserId && initialStatus === "delivered") {
                io.to(otherUserId.toString()).emit('message_status_updated', {
                    messageId: message._id,
                    conversationId: conversation._id,
                    status: "delivered"
                });
            }
        } catch (err) {
            console.error('send_message failed:', err.message);
        }
    });

    socket.on("mark_seen", async ({ conversationId } = {}) => {
        try {
            const userId = socket.user._id;
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !isParticipant(conversation, userId)) return;

            await Conversation.updateOne(
                { _id: conversation._id },
                { $set: { [`unreadCount.${userId}`]: 0 } }
            );

            await Message.updateMany(
                { conversation: conversationId, readBy: { $ne: userId } },
                { $addToSet: { readBy: userId }, $set: { status: "seen" } }
            );

            for (const participantId of conversation.participants) {
                if (!participantId.equals(userId)) {
                    io.to(participantId.toString()).emit('messages_seen', {
                        conversationId,
                        readByUserId: userId,
                        status: "seen"
                    });
                }
            }
        } catch (err) {
            console.error('mark_seen failed:', err.message);
        }
    });
};

module.exports = registerMessageHandlers;