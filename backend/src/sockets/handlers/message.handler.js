const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const { isOnline } = require('../onlineUsers');
const { verifyAttachment } = require('../../services/attachment.service');

const isParticipant = (conversation, userId) =>
    conversation.participants.some(p => p.equals(userId));

const registerMessageHandlers = (io, socket) => {
    // data: { receiver?, conversationId?, message?, attachment?, clientMsgId? }
    // cb:   ack -> { ok: true, message } | { ok: false, error }
    socket.on('send_message', async (data, cb) => {
        const ack = typeof cb === 'function' ? cb : () => {};

        try {
            const senderId = socket.user._id;
            const caption = typeof data?.message === 'string' ? data.message.trim() : '';
            const clientMsgId = typeof data?.clientMsgId === 'string'
                ? data.clientMsgId.slice(0, 64) : undefined;

            if (caption.length > 5000) return ack({ ok: false, error: 'Message too long' });
            if (!caption && !data?.attachment) return ack({ ok: false, error: 'Empty message' });

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

            if (!conversation || !isParticipant(conversation, senderId)) {
                return ack({ ok: false, error: 'Not allowed' });
            }

            // retry of a message we already stored -> return it, don't duplicate
            if (clientMsgId) {
                const existing = await Message.findOne({ sender: senderId, clientMsgId });
                if (existing) return ack({ ok: true, duplicate: true, message: existing });
            }

            // attachments: verify with Cloudinary, never trust client metadata
            let type = 'text';
            let attachment;
            if (data.attachment) {
                attachment = await verifyAttachment(data.attachment, conversation._id);
                type = attachment.resourceType === 'image' ? 'image' : 'file';
            }

            const content = caption ||
                (type === 'image' ? '📷 Photo' : type === 'file' ? `📎 ${attachment.originalName}` : '');

            let initialStatus = "sent";
            let otherUserId = null;
            if (!conversation.isGroup) {
                otherUserId = conversation.participants.find(p => !p.equals(senderId));
                if (otherUserId && await isOnline(otherUserId.toString())) {
                    initialStatus = "delivered";
                }
            }

            let message;
            try {
                message = await Message.create({
                    conversation: conversation._id,
                    sender: senderId,
                    receiver: data.receiver || null,
                    content,
                    type,
                    caption: type === 'text' ? '' : caption,
                    attachment,
                    clientMsgId,
                    status: initialStatus,
                    readBy: [senderId]
                });
            } catch (err) {
                // two retries racing each other: unique index caught the second one
                if (err.code === 11000 && clientMsgId) {
                    const existing = await Message.findOne({ sender: senderId, clientMsgId });
                    if (existing) return ack({ ok: true, duplicate: true, message: existing });
                }
                throw err;
            }

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
                type: message.type,
                caption: message.caption,
                attachment: message.attachment,
                clientMsgId: message.clientMsgId,
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

            ack({ ok: true, message: messagePayload });
        } catch (err) {
            console.error('send_message failed:', err.message);
            ack({ ok: false, error: err.expose ? err.message : 'Failed to send message' });
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
