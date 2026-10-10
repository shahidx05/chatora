const Conversation = require('../../models/Conversation');

const registerTypingHandlers = (io, socket) => {
    socket.on('typing', async (data) => {
        try {
            const myId = socket.user._id;
            const payload = {
                sender: myId,
                senderName: socket.user.name,
                conversationId: data?.conversationId,
                typing: data?.typing
            };

            if (data?.conversationId) {
                const conversation = await Conversation.findById(data.conversationId);
                if (!conversation || !conversation.participants.some(p => p.equals(myId))) return;

                for (const participantId of conversation.participants) {
                    if (!participantId.equals(myId)) {
                        io.to(participantId.toString()).emit('typing', payload);
                    }
                }
            } else if (data?.receiver) {
                io.to(data.receiver.toString()).emit('typing', payload);
            }
        } catch (err) {
            console.error('typing failed:', err.message);
        }
    });
};

module.exports = registerTypingHandlers;