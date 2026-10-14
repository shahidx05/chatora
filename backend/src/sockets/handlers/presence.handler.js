const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const { setOnline, refreshOnline, removeSocket, getOnlineAmong } = require('../onlineUsers');
const { presenceRoom, contactIdsFrom } = require('../../services/presence.service');
const { markPendingDelivered } = require('../../services/receipts.service');

const registerPresenceHandlers = async (io, socket) => {
    const userId = socket.user._id.toString();

    // CRITICAL: join personal room FIRST, before any async Redis call.
    // If Redis is down, the user must still be reachable via io.to(userId).emit(...)
    socket.join(userId);

    const heartbeat = setInterval(() => {
        refreshOnline(userId, socket.id).catch(() => {});
    }, 30000);

    socket.on('disconnect', async () => {
        clearInterval(heartbeat);
        try {
            const fullyOffline = await removeSocket(userId, socket.id);
            if (fullyOffline) {
                const lastSeen = new Date();
                await User.findByIdAndUpdate(userId, { lastSeen });
                io.to(presenceRoom(userId)).emit('user_offline', { userId, lastSeen });
            }
        } catch (err) {
            console.error('Disconnect cleanup failed:', err.message);
        }
        console.log(`❌ ${socket.user.username} disconnected`);
    });

    // Redis presence — best-effort; if Redis is down, messaging still works
    let cameOnline = false;
    try {
        cameOnline = await setOnline(userId, socket.id);
    } catch (err) {
        console.error('setOnline failed (Redis down?):', err.message);
    }
    console.log(`✅ ${socket.user.username} connected (${socket.id})`);

    // one query: my contacts (for presence) + my conversations (for pending deliveries)
    const conversations = await Conversation.find({ participants: socket.user._id })
        .select('isGroup participants unreadCount lastRead')
        .lean();
    const contactIds = contactIdsFrom(conversations, userId);

    // subscribe to my contacts' status, and learn who of them is online right now
    if (contactIds.length) socket.join(contactIds.map(presenceRoom));

    try {
        const onlineContacts = await getOnlineAmong(contactIds);
        socket.emit('online_users', [...onlineContacts]);
    } catch {
        socket.emit('online_users', []); // Redis down: emit empty, not a crash
    }

    // announce myself to my subscribers
    if (cameOnline) io.to(presenceRoom(userId)).emit('user_online', { userId });

    // messages that arrived while I was offline are now delivered
    markPendingDelivered(io, userId, conversations).catch(err =>
        console.error('markPendingDelivered failed:', err.message));
};

module.exports = registerPresenceHandlers;
