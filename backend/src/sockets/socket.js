const jwt = require('jsonwebtoken');
const User = require('./../models/User');
const Message = require('./../models/Message');
const Conversation = require('./../models/Conversation');

const onlineUsers = new Map(); // Map to store online users

const initSocket = (io) => {
    // middleware: runs before every connection is accepted
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Authentication error: no token'));
            }

            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(payload.id).select('-password');

            if (!user) {
                return next(new Error('Authentication error: user not found'));
            }

            socket.user = user; // attach user info to this socket
            next();
        } catch (err) {
            next(new Error('Authentication error: invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.user._id.toString();
        onlineUsers.set(userId, socket.id); // store the socket ID for this user
        console.log(`✅ ${socket.user.username} connected (${socket.id})`);
        io.emit('user_online', { userId: userId });

        socket.emit("online_users", [...onlineUsers.keys()]);
        // socket.emit("online_users", Array.from(onlineUsers.keys()));

        const updateDeliveredMessages = async (userId) => {
            const messages = await Message.find({
                receiver: userId,
                status: "sent"
            });

            await Message.updateMany(
                {
                    receiver: userId,
                    status: "sent"
                },
                {
                    $set: {
                        status: "delivered"
                    }
                }
            );

            for (const msg of messages) {
                const senderSocketId = onlineUsers.get(msg.sender.toString());

                if (senderSocketId) {
                    io.to(senderSocketId).emit("message_status_updated", {
                        messageId: msg._id,
                        status: "delivered"
                    });
                }
            }

        };
        updateDeliveredMessages(userId)

        // console.log('a user connected', socket.id);

        // socket.emit('me', socket.user);
        // socket.emit('welcome', `Welcome, ${socket.user.username}!`);
        // socket.broadcast.emit('welcome', `Welcome, ${socket.id}!`);
        // io.emit('welcome', `Welcome, ${socket.id}!`);
        // socket.on('message', (msg) => {
        //     io.emit('mess', `${socket.user.username}: ${msg}`);
        // })

        socket.on('send_message', async (data) => {
            const senderId = socket.user._id;
            const receiverId = data.receiver;

            const status = onlineUsers.has(receiverId) ? "delivered" : "sent";

            let conversation;
            if (data.conversationId) {
                conversation = await Conversation.findById(data.conversationId);
            } else {
                conversation = await Conversation.findOne({
                    participants: { $all: [senderId, receiverId] },
                    $expr: { $eq: [{ $size: "$participants" }, 2] }
                });
            }

            if (!conversation) {
                conversation = await Conversation.create({ participants: [senderId, receiverId] });
            }

            const message = await Message.create({
                conversation: conversation._id,
                sender: senderId,
                receiver: receiverId,
                content: data.message,
                status
            });

            conversation.lastMessage = message._id;
            const currentCount = conversation.unreadCount.get(receiverId.toString()) || 0;
            conversation.unreadCount.set(receiverId.toString(), currentCount + 1);
            await conversation.save();

            if (onlineUsers.has(receiverId)) {
                socket.to(onlineUsers.get(receiverId)).emit('message_status_updated', {
                    messageId: message._id,
                    status: "delivered"
                });
            }

            io.to([onlineUsers.get(receiverId), socket.id]).emit('receive_message', {
                _id: message._id,
                conversation: message.conversation,
                sender: message.sender,
                receiver: message.receiver,
                content: message.content,
                status,
                createdAt: message.createdAt
            });
        })

        socket.on("mark_seen", async ({ conversationId }) => {
            const receiverId = socket.user._id;

            const conversation = await Conversation.findById(conversationId);
            if (!conversation) return;

            const senderId = conversation.participants.find(
                (p) => p.toString() !== receiverId.toString()
            );

            const messages = await Message.find({
                conversation: conversationId,
                receiver: receiverId,
                status: "delivered"
            });

            await Message.updateMany(
                { conversation: conversationId, receiver: receiverId, status: "delivered" },
                { $set: { status: "seen" } }
            );

            conversation.unreadCount.set(receiverId.toString(), 0);
            await conversation.save();

            const senderSocketId = onlineUsers.get(senderId?.toString());
            if (senderSocketId) {
                for (const msg of messages) {
                    io.to(senderSocketId).emit("message_status_updated", {
                        messageId: msg._id,
                        status: "seen"
                    });
                }
            }
        });

        socket.on('typing', (data) => {
            socket.to(onlineUsers.get(data.receiver)).emit('typing', {
                sender: socket.user._id,
                typing: data.typing
            });
        });

        socket.on("disconnect", async () => {
            const lastSeen = new Date();

            await User.findByIdAndUpdate(userId, {
                lastSeen
            });

            onlineUsers.delete(userId);

            io.emit("user_offline", {
                userId,
                lastSeen
            });

            console.log(`❌ ${socket.user.username} disconnected`);
        });
    });
}

module.exports = initSocket;
