const User = require('../../models/User');
const Conversation = require('../../models/Conversation');
const { setOnline, refreshOnline, removeSocket, getOnlineAmong } = require('../onlineUsers');
const { presenceRoom, contactIdsFrom } = require('../../services/presence.service');
const { markPendingDelivered } = require('../../services/receipts.service');

const registerPresenceHandlers = async (io, socket) => {
    const userId = socket.user._id.toString();

    // personal room: every tab/device of this user, on any server instance
    socket.join(userId);

    const heartbeat = setInterval(() => {
        refreshOnline(userId, socket.id).catch(console.error);
    }, 30000);

    socket.on("disconnect", async () => {
        clearInterval(heartbeat);
        try {
            const fullyOffline = await removeSocket(userId, socket.id);
            if (fullyOffline) {
                const lastSeen = new Date();
                await User.findByIdAndUpdate(userId, { lastSeen });
                // only the people who subscribed to me hear about it
                io.to(presenceRoom(userId)).emit("user_offline", { userId, lastSeen });
            }
        } catch (err) {
            console.error('Disconnect cleanup failed:', err.message);
        }
        console.log(`❌ ${socket.user.username} disconnected`);
    });

    const cameOnline = await setOnline(userId, socket.id);
    console.log(`✅ ${socket.user.username} connected (${socket.id})`);

    // one query: my contacts (for presence) + my conversations (for pending deliveries)
    const conversations = await Conversation.find({ participants: socket.user._id })
        .select('isGroup participants unreadCount lastRead')
        .lean();
    const contactIds = contactIdsFrom(conversations, userId);

    // subscribe to my contacts' status, and learn who of them is online right now
    if (contactIds.length) socket.join(contactIds.map(presenceRoom));
    const onlineContacts = await getOnlineAmong(contactIds);
    socket.emit("online_users", [...onlineContacts]);

    // announce myself to my subscribers (only on the first tab, not every reconnect of a second tab)
    if (cameOnline) io.to(presenceRoom(userId)).emit('user_online', { userId });

    // messages that arrived while I was offline are now delivered
    markPendingDelivered(io, userId, conversations).catch(console.error);
};

module.exports = registerPresenceHandlers;
