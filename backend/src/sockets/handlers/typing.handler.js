const Conversation = require('../../models/Conversation');
const { getSocketId } = require('../onlineUsers');

const registerTypingHandlers = (io, socket) => {
    socket.on('typing', async (data) => {
        if (data.conversationId) {
            const conversation = await Conversation.findById(data.conversationId);
            if (!conversation) return;

            for (const participantId of conversation.participants) {
                if (participantId.toString() !== socket.user._id.toString()) {
                    const participantSocketId = await getSocketId(participantId.toString());
                    if (participantSocketId) {
                        io.to(participantSocketId).emit('typing', {
                            sender: socket.user._id,
                            senderName: socket.user.name,
                            conversationId: data.conversationId,
                            typing: data.typing
                        });
                    }
                }
            }
        } else if (data.receiver) {
            const receiverSocket = await getSocketId(data.receiver);   // ADDED await
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