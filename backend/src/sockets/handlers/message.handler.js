const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const { getSocketId, isOnline } = require('../onlineUsers');

const registerMessageHandlers = (io, socket) => {
    socket.on('send_message', async (data) => {
        const senderId = socket.user._id;

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

        if (!conversation) return;

        let initialStatus = "sent";
        let otherUserId = null;
        if (!conversation.isGroup) {
            otherUserId = conversation.participants.find(p => p.toString() !== senderId.toString());
            if (otherUserId && await isOnline(otherUserId.toString())) { 
                initialStatus = "delivered";
            }
        }

        const message = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            receiver: data.receiver || null,
            content: data.message,
            status: initialStatus,
            readBy: [senderId]
        });

        conversation.lastMessage = message._id;

        conversation.participants.forEach(participantId => {
            if (participantId.toString() !== senderId.toString()) {
                const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
                conversation.unreadCount.set(participantId.toString(), currentCount + 1);
            }
        });

        await conversation.save();

        const messagePayload = {
            _id: message._id,
            conversation: message.conversation,
            sender: {
                _id: senderId,
                name: socket.user.name
            },
            receiver: message.receiver,
            content: message.content,
            status: message.status,
            readBy: message.readBy,
            createdAt: message.createdAt
        };

        for (const participantId of conversation.participants) {
            const participantSocketId = await getSocketId(participantId.toString());
            if (participantSocketId) {
                io.to(participantSocketId).emit('receive_message', messagePayload);
            }
        }

        if (!conversation.isGroup && otherUserId) {
            const otherSocketId = await getSocketId(otherUserId.toString());   // ADDED await
            if (otherSocketId && initialStatus === "delivered") {
                io.to(otherSocketId).emit('message_status_updated', {
                    messageId: message._id,
                    conversationId: conversation._id,
                    status: "delivered"
                });
            }
        }
    });

    socket.on("mark_seen", async ({ conversationId }) => {
        const userId = socket.user._id;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        await Message.updateMany(
            { conversation: conversationId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId }, $set: { status: "seen" } }
        );

        for (const participantId of conversation.participants) {
            if (participantId.toString() !== userId.toString()) {
                const participantSocketId = await getSocketId(participantId.toString());
                if (participantSocketId) {
                    io.to(participantSocketId).emit('messages_seen', {
                        conversationId,
                        readByUserId: userId,
                        status: "seen"
                    });
                }
            }
        }
    });
};

module.exports = registerMessageHandlers;