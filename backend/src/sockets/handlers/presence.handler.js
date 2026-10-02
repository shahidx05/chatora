const User = require('../../models/User');
const Message = require('../../models/Message');
const { setOnline, setOffline, getSocketId, getAllOnlineUserIds } = require('../onlineUsers');

const updateDeliveredMessages = async (io, userId) => {
    const messages = await Message.find({ receiver: userId, status: "sent" });

    await Message.updateMany(
        { receiver: userId, status: "sent" },
        { $set: { status: "delivered" } }
    );

    for (const msg of messages) {
        const senderSocketId = await getSocketId(msg.sender.toString());
        if (senderSocketId) {
            io.to(senderSocketId).emit("message_status_updated", {
                messageId: msg._id,
                status: "delivered"
            });
        }
    }
};

const registerPresenceHandlers = async (io, socket) => {  
    const userId = socket.user._id.toString();

    await setOnline(userId, socket.id);   
    console.log(`✅ ${socket.user.username} connected (${socket.id})`);

    io.emit('user_online', { userId });
    socket.emit("online_users", await getAllOnlineUserIds());   

    updateDeliveredMessages(io, userId);   

    socket.on("disconnect", async () => {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen });

        if (await getSocketId(userId) === socket.id) {   
            await setOffline(userId);   
            io.emit("user_offline", { userId, lastSeen });
        }

        console.log(`❌ ${socket.user.username} disconnected`);
    });
};

module.exports = registerPresenceHandlers;