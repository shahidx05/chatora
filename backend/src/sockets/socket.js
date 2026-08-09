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

        // --- SEND MESSAGE HANDLER ---
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
            if (!conversation.isGroup) {
                const otherUserId = conversation.participants.find(p => p.toString() !== senderId.toString());
                if (otherUserId && onlineUsers.has(otherUserId.toString())) {
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
                sender: { _id: senderId, name: socket.user.name },
                receiver: message.receiver,
                content: message.content,
                status: message.status,
                readBy: message.readBy,
                createdAt: message.createdAt
            };

            conversation.participants.forEach(participantId => {
                const participantSocketId = onlineUsers.get(participantId.toString());

                if (participantSocketId) {
                    io.to(participantSocketId).emit('receive_message', messagePayload);
                }
            });

            // if (onlineUsers.has(data.receiver)) {
            //     socket.to(onlineUsers.get(data.receiver)).emit('message_status_updated', {
            //         messageId: message._id,
            //         status: "delivered"
            //     });
            // }

            if (!conversation.isGroupChat) {
                const otherUserId = conversation.participants.find(p => p.toString() !== senderId.toString());
                const otherSocketId = onlineUsers.get(otherUserId?.toString());

                if (otherSocketId && initialStatus === "delivered") {
                    io.to(otherSocketId).emit('message_status_updated', {
                        messageId: message._id,
                        conversationId: conversation._id,
                        status: "delivered"
                    });
                }
            }
        })

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

            conversation.participants.forEach(participantId => {
                if (participantId.toString() !== userId.toString()) {
                    const participantSocketId = onlineUsers.get(participantId.toString());
                    if (participantSocketId) {
                        io.to(participantSocketId).emit('messages_seen', {
                            conversationId: conversationId,
                            readByUserId: userId,
                            status: "seen"
                        });
                    }
                }
            });
        });

        socket.on('typing', async (data) => {
            if (data.conversationId) {
                const conversation = await Conversation.findById(data.conversationId);
                if (!conversation) return;

                conversation.participants.forEach(participantId => {
                    if (participantId.toString() !== socket.user._id.toString()) {
                        const participantSocketId = onlineUsers.get(participantId.toString());
                        if (participantSocketId) {
                            io.to(participantSocketId).emit('typing', {
                                sender: socket.user._id,
                                senderName: socket.user.name,
                                conversationId: data.conversationId,
                                typing: data.typing
                            });
                        }
                    }
                })
            }
            else if (data.receiver) {
                const receiverSocket = onlineUsers.get(data.receiver);
                if (receiverSocket) {
                    io.to(receiverSocket).emit('typing', {
                        sender: socket.user._id,
                        senderName: socket.user.name,
                        conversationId: data.conversationId,
                        typing: data.typing
                    });
                }
            }
        });

        socket.on("disconnect", async () => {
            const lastSeen = new Date();

            await User.findByIdAndUpdate(userId, {
                lastSeen
            });

            if (onlineUsers.get(userId) === socket.id) {
                onlineUsers.delete(userId);

                io.emit("user_offline", {
                    userId,
                    lastSeen
                });
            }

            console.log(`❌ ${socket.user.username} disconnected`);
        });
    });
}

module.exports = initSocket;
