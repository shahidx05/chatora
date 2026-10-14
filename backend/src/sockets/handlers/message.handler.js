const mongoose = require('mongoose');
const Message = require('../../models/Message');
const Conversation = require('../../models/Conversation');
const { getOnlineAmong } = require('../onlineUsers');
const { verifyAttachment } = require('../../services/attachment.service');
const { summarize, markSeen } = require('../../services/receipts.service');
const { linkContacts } = require('../../services/presence.service');
const cloudinary = require('../../config/cloudinary');

const isParticipant = (conversation, userId) =>
    conversation.participants.some(p => p.equals(userId));

// Build a reply snapshot server-side; never trust the client's preview text.
const buildReplySnapshot = (original) => {
    let preview;
    if (original.type === 'image') preview = 'Photo';
    else if (original.type === 'file') preview = original.attachment?.originalName || 'File';
    else preview = original.content || '';

    return {
        messageId: original._id,
        senderName: original.sender?.name || 'Unknown',
        type: original.type || 'text',
        preview: preview.slice(0, 100),
        deleted: false
    };
};

// what every participant receives for a new message
// (no deletedFor / recipients / deliveredTo / readBy; counts instead)
const buildPayload = (message, user, memberIds) => ({
    _id: message._id,
    conversation: message.conversation,
    sender: { _id: user._id, name: user.name },
    receiver: message.receiver,
    content: message.content,
    type: message.type,
    caption: message.caption,
    attachment: message.attachment,
    clientMsgId: message.clientMsgId,
    replyTo: message.replyTo,
    isDeleted: false,
    createdAt: message.createdAt,
    ...summarize(message, memberIds) // status, recipientCount, deliveredCount, readCount
});

// sidebar preview change after delete-for-everyone.
// Only relevant if the deleted message IS the conversation's lastMessage.
const repairLastMessageForEveryone = (io, conversation, deletedMsgId, deletedAt) => {
    for (const pid of conversation.participants) {
        io.to(pid.toString()).emit('conversation_updated', {
            conversationId: conversation._id,
            lastMessage: 'This message was deleted',
            lastMessageId: deletedMsgId,
            lastMessageTime: deletedAt
        });
    }
};

// delete-for-me: Conversation.lastMessage is shared and NOT changed.
// Only the actor's sidebar gets a fallback preview.
const repairLastMessageForMe = async (io, conversation, deletedMsgId, actorId) => {
    const fallback = await Message.findOne({
        conversation: conversation._id,
        _id: { $ne: deletedMsgId },
        deletedFor: { $ne: actorId },
        isDeleted: { $ne: true }
    }).sort({ _id: -1 }).select('content createdAt').lean();

    io.to(actorId.toString()).emit('conversation_updated', {
        conversationId: conversation._id,
        lastMessage: fallback ? fallback.content : null,
        lastMessageId: fallback ? fallback._id : null,
        lastMessageTime: fallback ? fallback.createdAt : null
    });
};

const registerMessageHandlers = (io, socket) => {
    // data: { receiver?, conversationId?, message?, attachment?, clientMsgId?, replyToId? }
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
            let createdNew = false;
            if (data.conversationId) {
                conversation = await Conversation.findById(data.conversationId);
            } else if (data.receiver) {
                conversation = await Conversation.findOne({
                    isGroup: false,
                    participants: { $all: [senderId, data.receiver] },
                    $expr: { $eq: [{ $size: '$participants' }, 2] }
                });
                if (!conversation) {
                    conversation = await Conversation.create({
                        isGroup: false,
                        participants: [senderId, data.receiver]
                    });
                    createdNew = true;
                }
            }

            if (!conversation || !isParticipant(conversation, senderId)) {
                return ack({ ok: false, error: 'Not allowed' });
            }

            // new 1-to-1 chat: both users become each other's presence contacts
            if (createdNew) {
                try { await linkContacts(io, senderId, data.receiver); }
                catch (err) { console.error('linkContacts failed:', err.message); }
            }

            const memberIds = conversation.participants.map(String);

            // retry of a message we already stored -> return it, don't duplicate
            if (clientMsgId) {
                const existing = await Message.findOne({ sender: senderId, clientMsgId });
                if (existing) {
                    return ack({ ok: true, duplicate: true, message: buildPayload(existing, socket.user, memberIds) });
                }
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

            // --- reply: validate replyToId and build the snapshot ---
            let replyTo;
            if (data.replyToId) {
                if (!mongoose.isValidObjectId(data.replyToId)) {
                    return ack({ ok: false, error: 'Invalid replyToId' });
                }
                const original = await Message.findOne({
                    _id: data.replyToId,
                    conversation: conversation._id // must belong to the same conversation
                }).populate('sender', 'name').lean();

                if (!original) {
                    return ack({ ok: false, error: 'Original message not found in this conversation' });
                }
                if (original.isDeleted || (original.deletedFor || []).some(id => id.equals(senderId))) {
                    return ack({ ok: false, error: 'Cannot reply to a deleted message' });
                }
                replyTo = buildReplySnapshot(original);
            }

            // who is this for, and who already has a live connection (= delivered right away)?
            const recipients = conversation.participants.filter(p => !p.equals(senderId));
            let online = new Set();
            try {
                online = await getOnlineAmong(recipients.map(String));
            } catch (err) {
                console.error('presence lookup failed (Redis down?):', err.message); // treated as offline
            }
            const deliveredTo = [senderId, ...recipients.filter(r => online.has(String(r)))];
            const initialStatus =
                recipients.length > 0 && online.size === recipients.length ? 'delivered' : 'sent';

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
                    replyTo,
                    recipients,
                    deliveredTo,
                    readBy: [senderId],
                    status: initialStatus
                });
            } catch (err) {
                // two retries racing each other: the unique index caught the second one
                if (err.code === 11000 && clientMsgId) {
                    const existing = await Message.findOne({ sender: senderId, clientMsgId });
                    if (existing) {
                        return ack({ ok: true, duplicate: true, message: buildPayload(existing, socket.user, memberIds) });
                    }
                }
                throw err;
            }

            // atomic update: no lost counts when messages arrive together
            const update = { $set: { lastMessage: message._id } };
            const inc = {};
            for (const p of recipients) inc[`unreadCount.${p}`] = 1;
            if (Object.keys(inc).length) update.$inc = inc;
            await Conversation.updateOne({ _id: conversation._id }, update);

            const messagePayload = buildPayload(message, socket.user, memberIds);
            for (const participantId of conversation.participants) {
                io.to(participantId.toString()).emit('receive_message', messagePayload);
            }

            ack({ ok: true, message: messagePayload });
        } catch (err) {
            console.error('send_message failed:', err.message);
            ack({ ok: false, error: err.expose ? err.message : 'Failed to send message' });
        }
    });

    // data: { messageId, scope: 'me' | 'everyone' }
    // cb:   ack -> { ok: true } | { ok: false, error }
    socket.on('delete_message', async (data, cb) => {
        const ack = typeof cb === 'function' ? cb : () => {};

        try {
            const userId = socket.user._id;
            const { messageId, scope } = data || {};

            if (!messageId || !mongoose.isValidObjectId(messageId)) {
                return ack({ ok: false, error: 'Invalid messageId' });
            }
            if (scope !== 'me' && scope !== 'everyone') {
                return ack({ ok: false, error: 'scope must be "me" or "everyone"' });
            }

            const message = await Message.findById(messageId);
            if (!message) return ack({ ok: false, error: 'Message not found' });
            if (message.isSystemMessage) return ack({ ok: false, error: 'System messages cannot be deleted' });

            const conversation = await Conversation.findById(message.conversation)
                .select('participants lastMessage');
            if (!conversation || !isParticipant(conversation, userId)) {
                return ack({ ok: false, error: 'Not allowed' });
            }

            const isLast = String(conversation.lastMessage) === String(messageId);

            if (scope === 'everyone') {
                if (!message.sender.equals(userId)) {
                    return ack({ ok: false, error: 'Only the sender can delete for everyone' });
                }
                if (message.isDeleted) return ack({ ok: true }); // idempotent

                const attachment = message.attachment;
                const deletedAt = new Date();

                // 1. database first: the message is gone for users even if file cleanup fails
                await Message.updateOne({ _id: messageId }, {
                    $set: { isDeleted: true, deletedAt, content: 'This message was deleted', caption: '' },
                    $unset: { attachment: 1 }
                });

                // 2. messages quoting this one must stop showing its text
                const quoting = await Message.find({ 'replyTo.messageId': messageId }).select('_id').lean();
                const quotingIds = quoting.map(m => m._id);
                if (quotingIds.length) {
                    await Message.updateMany(
                        { _id: { $in: quotingIds } },
                        { $set: { 'replyTo.preview': '', 'replyTo.deleted': true } }
                    );
                }

                // 3. delete the file; failure is only logged
                if (attachment?.publicId) {
                    try {
                        await cloudinary.uploader.destroy(attachment.publicId, {
                            resource_type: attachment.resourceType || 'image'
                        });
                    } catch (err) {
                        console.error('Cloudinary destroy failed:', err.message);
                    }
                }

                // 4. sidebar changes only if this was the last message
                if (isLast) repairLastMessageForEveryone(io, conversation, messageId, deletedAt);

                for (const pid of conversation.participants) {
                    io.to(pid.toString()).emit('message_deleted', {
                        conversationId: conversation._id,
                        messageId,
                        scope: 'everyone',
                        affectedReplyIds: quotingIds
                    });
                }
                return ack({ ok: true });
            }

            // scope = 'me'
            if (!(message.deletedFor || []).some(id => id.equals(userId))) {
                await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
            }
            if (isLast) await repairLastMessageForMe(io, conversation, messageId, userId);

            // only this user's own room (all their tabs/devices)
            io.to(userId.toString()).emit('message_deleted', {
                conversationId: conversation._id,
                messageId,
                scope: 'me'
            });
            ack({ ok: true });
        } catch (err) {
            console.error('delete_message failed:', err.message);
            ack({ ok: false, error: 'Failed to delete message' });
        }
    });

    socket.on('mark_seen', async ({ conversationId } = {}) => {
        try {
            const userId = socket.user._id;
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !isParticipant(conversation, userId)) return;

            await Conversation.updateOne(
                { _id: conversation._id },
                { $set: { [`unreadCount.${userId}`]: 0 } }
            );

            // records my read receipt per message and tells each sender (not everyone)
            await markSeen(io, conversation, userId);
        } catch (err) {
            console.error('mark_seen failed:', err.message);
        }
    });
};

module.exports = registerMessageHandlers;
