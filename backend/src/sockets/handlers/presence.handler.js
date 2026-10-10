const User = require('../../models/User');
const Message = require('../../models/Message');
const { setOnline, refreshOnline, removeSocket, getAllOnlineUserIds } = require('../onlineUsers');

const updateDeliveredMessages = async (io, userId) => {
    const messages = await Message.find({ receiver: userId, status: "sent" });
    if (messages.length === 0) return;

    await Message.updateMany(
        { receiver: userId, status: "sent" },
        { $set: { status: "delivered" } }
    );

    for (const msg of messages) {
        io.to(msg.sender.toString()).emit("message_status_updated", {
            messageId: msg._id,
            status: "delivered"
        });
    }
};

const registerPresenceHandlers = async (io, socket) => {
    const userId = socket.user._id.toString();

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
                io.emit("user_offline", { userId, lastSeen });
            }
        } catch (err) {
            console.error('Disconnect cleanup failed:', err.message);
        }
        console.log(`❌ ${socket.user.username} disconnected`);
    });

    await setOnline(userId, socket.id);
    console.log(`✅ ${socket.user.username} connected (${socket.id})`);

    io.emit('user_online', { userId });
    socket.emit("online_users", await getAllOnlineUserIds());

    updateDeliveredMessages(io, userId).catch(console.error);
};

module.exports = registerPresenceHandlers;