const Conversation = require('../../models/Conversation');
const { getSocketId } = require('../onlineUsers');

const registerTypingHandlers = (io, socket) => {
    socket.on('typing', async (data) => {
        if (data.conversationId) {
            const conversation = await Conversation.findById(data.conversationId);
            if (!conversation) return;

            conversation.participants.forEach(participantId => {
                if (participantId.toString() !== socket.user._id.toString()) {
                    const participantSocketId = getSocketId(participantId.toString());
                    if (participantSocketId) {
                        io.to(participantSocketId).emit('typing', {
                            sender: socket.user._id,
                            senderName: socket.user.name,
                            conversationId: data.conversationId,
                            typing: data.typing
                        });
                    }
                }
            });
        } else if (data.receiver) {
            const receiverSocket = getSocketId(data.receiver);
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
};

module.exports = registerTypingHandlers;