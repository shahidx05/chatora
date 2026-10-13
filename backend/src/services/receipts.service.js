const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const RANK = { sent: 0, delivered: 1, seen: 2 };
const str = (id) => String(id);
const senderIdOf = (msg) => str(msg.sender?._id || msg.sender); // works for populated senders too

// Mongoose Map on a document, plain object on a .lean() result
const mapGet = (m, key) => (!m ? undefined : typeof m.get === 'function' ? m.get(key) : m[key]);

/**
 * Who is this message still waiting on?
 * = the people it was sent to, minus anyone who has since left the group.
 * Messages from before receipts existed have no snapshot: fall back to "everyone but the sender".
 */
const neededRecipients = (msg, memberIds) => {
    const members = new Set(memberIds);
    const snapshot = (msg.recipients || []).map(str);
    const sender = senderIdOf(msg);
    const base = snapshot.length ? snapshot : memberIds.filter(id => id !== sender);
    return base.filter(id => members.has(id));
};

/**
 * Derive status + counts from the per-user arrays (the single source of truth).
 * Status only ever moves forward: sent -> delivered -> seen.
 */
const summarize = (msg, memberIds) => {
    const needed = neededRecipients(msg, memberIds);
    const delivered = new Set((msg.deliveredTo || []).map(str));
    const read = new Set((msg.readBy || []).map(str));

    const readCount = needed.filter(id => read.has(id)).length;
    // reading a message implies it was delivered
    const deliveredCount = needed.filter(id => delivered.has(id) || read.has(id)).length;

    let derived = 'sent';
    if (needed.length > 0 && readCount === needed.length) derived = 'seen';
    else if (needed.length > 0 && deliveredCount === needed.length) derived = 'delivered';

    const current = msg.status || 'sent';
    const status = RANK[derived] > RANK[current] ? derived : current;

    return { status, recipientCount: needed.length, deliveredCount, readCount };
};

// what the client receives for a stored message (no big id arrays, just the numbers)
const toClient = (doc, memberIds) => {
    const m = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    // eslint-disable-next-line no-unused-vars
    const { recipients, deliveredTo, readBy, __v, ...rest } = m;
    return { ...rest, ...summarize(m, memberIds) };
};

/**
 * `userId` has just received (kind = 'delivered') or read (kind = 'seen') these messages.
 * Records it, promotes message status where everyone is covered, and tells each
 * message's sender (only them) the new status and counts.
 */
const applyReceipts = async (io, conversation, messageIds, userId, kind) => {
    if (!messageIds.length) return;

    const memberIds = conversation.participants.map(str);
    const me = str(userId);

    await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: kind === 'seen' ? { readBy: userId, deliveredTo: userId } : { deliveredTo: userId } }
    );

    // re-read after our write: whoever reads last always sees everyone's receipts
    const msgs = await Message.find({ _id: { $in: messageIds } })
        .select('sender status recipients deliveredTo readBy').lean();

    const toSeen = [];
    const toDelivered = [];
    const bySender = new Map();

    for (const m of msgs) {
        const s = summarize(m, memberIds);
        if (s.status !== (m.status || 'sent')) {
            (s.status === 'seen' ? toSeen : toDelivered).push(m._id);
        }

        const senderId = senderIdOf(m);
        if (senderId === me) continue; // my own messages: nothing to tell myself
        if (!bySender.has(senderId)) bySender.set(senderId, []);
        bySender.get(senderId).push({ messageId: m._id, ...s });
    }

    if (toSeen.length) {
        await Message.updateMany({ _id: { $in: toSeen } }, { $set: { status: 'seen' } });
    }
    if (toDelivered.length) {
        await Message.updateMany({ _id: { $in: toDelivered }, status: 'sent' }, { $set: { status: 'delivered' } });
    }

    for (const [senderId, updates] of bySender) {
        io.to(senderId).emit('message_receipts', { conversationId: conversation._id, updates });
    }
};

// `userId` opened the conversation: mark everything new as read by them
const markSeen = async (io, conversation, userId) => {
    const me = str(userId);

    const filter = {
        conversation: conversation._id,
        sender: { $ne: userId },
        readBy: { $ne: userId }
    };
    const cursor = mapGet(conversation.lastRead, me);
    if (cursor) filter._id = { $gt: cursor }; // only look at messages newer than my last read

    const unread = await Message.find(filter).select('_id').lean();
    if (!unread.length) return;

    const ids = unread.map(m => m._id);
    await applyReceipts(io, conversation, ids, userId, 'seen');

    const newest = ids.reduce((a, b) => (str(a) > str(b) ? a : b));
    await Conversation.updateOne(
        { _id: conversation._id },
        { $max: { [`lastRead.${me}`]: newest } }
    );
};

// `userId` just came online: everything sent to them while offline is now delivered
const markPendingDelivered = async (io, userId, conversations) => {
    const me = str(userId);

    for (const conv of conversations) {
        if (!(mapGet(conv.unreadCount, me) > 0)) continue; // nothing unread -> nothing undelivered

        const filter = {
            conversation: conv._id,
            sender: { $ne: userId },
            isSystemMessage: { $ne: true },
            deliveredTo: { $ne: userId }
        };
        const cursor = mapGet(conv.lastRead, me);
        if (cursor) filter._id = { $gt: cursor }; // anything at/below my read cursor was already delivered

        const pending = await Message.find(filter).select('_id').lean();
        await applyReceipts(io, conv, pending.map(m => m._id), userId, 'delivered');
    }
};

module.exports = { summarize, toClient, applyReceipts, markSeen, markPendingDelivered };
