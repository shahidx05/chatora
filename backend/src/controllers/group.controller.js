const Conversation = require('../models/Conversation');

exports.createGroup = async (req, res) => {
    try {
        const { groupName, participants } = req.body;

        if (!groupName || !participants || participants.length < 1) {
            return res.status(400).json({ message: "Group name and at least 1 other participant is required" });
        }

        const allParticipants = [...participants, req.user.id];

        const groupChat = await Conversation.create({
            isGroup: true,
            groupName: groupName,
            groupAdmin: req.user.id,
            participants: allParticipants
        });

        res.status(201).json({
            success: true,
            groupId: groupChat._id,
            isGroup: groupChat.isGroup,
            groupName: groupChat.groupName,
            groupAdmin: groupChat.groupAdmin,
            participants: groupChat.participants
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
