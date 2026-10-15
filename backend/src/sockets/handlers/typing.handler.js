const Conversation = require('../../models/Conversation');

const registerTypingHandlers = (io, socket) => {
    // per-socket throttle state (this function runs once per connected socket)
    let lastState = null;
    let lastSentAt = 0;

    socket.on('typing', async (data) => {
        try {
            const typing = Boolean(data?.typing);

            // the client fires this on every keystroke: drop repeats of the same state within 1.5s.
            // A change (typing -> stopped) always goes through.
            const now = Date.now();
            if (typing === lastState && now - lastSentAt < 1500) return;
            lastState = typing;
            lastSentAt = now;

            const myId = socket.user._id;
            const payload = {
                sender: myId,
                senderName: socket.user.name,
                conversationId: data?.conversationId,
                typing
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