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

exports.addMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { newMembers } = req.body;
        const adminName = req.user.name;

        if (!newMembers || newMembers.length === 0) {
            return res.status(400).json({ message: "No members provided to add" });
        }

        const group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (!group.groupAdmins.includes(req.user.id)) {
            return res.status(403).json({ message: "Only admins can add members" });
        }

        const updatedGroup = await Conversation.findByIdAndUpdate(
            groupId,
            {
                $addToSet: { participants: { $each: newMembers } }
            },
            { new: true } // Return updated document
        );

        const systemMessage = await Message.create({
            conversation: groupId,
            sender: req.user.id,
            content: `${adminName} added new members`,
            isSystemMessage: true,
            readBy: updatedGroup.participants
        });

        updatedGroup.lastMessage = systemMessage._id;
        await updatedGroup.save();

        const fullUpdatedGroup = await Conversation.findById(groupId)
            .populate("participants", "-password")
            .populate("groupAdmins", "-password");

        res.status(200).json({ success: true, conversation: fullUpdatedGroup });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userIdToRemove } = req.body;

        const group = await Conversation.findById(groupId);

        if (!group.groupAdmins.includes(req.user.id)) {
            return res.status(403).json({ message: "Only admins can remove members" });
        }

        const updatedGroup = await Conversation.findByIdAndUpdate(
            groupId,
            {
                $pull: { participants: userIdToRemove, groupAdmins: userIdToRemove }
            },
            { new: true }
        ).populate("participants", "-password").populate("groupAdmins", "-password");

        res.status(200).json({ success: true, conversation: updatedGroup });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { groupName, groupDescription } = req.body;

        const group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (!group.groupAdmins.includes(req.user.id)) {
            return res.status(403).json({ message: "Only admins can update group info" });
        }

        if (groupName) group.groupName = groupName;
        if (groupDescription !== undefined) group.groupDescription = groupDescription;

        await group.save();

        const updatedGroup = await Conversation.findById(groupId)
            .populate("participants", "-password")
            .populate("groupAdmins", "-password");

        res.status(200).json({ success: true, conversation: updatedGroup });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.manageAdmin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { targetUserId, action } = req.body;

        const group = await Conversation.findById(groupId);

        if (!group.groupAdmins.includes(req.user.id)) {
            return res.status(403).json({ message: "Only admins can manage roles" });
        }

        let updateQuery = {};
        if (action === 'promote') {
            updateQuery = { $addToSet: { groupAdmins: targetUserId } };
        } else if (action === 'demote') {
            if (group.groupAdmins.length === 1 && group.groupAdmins.includes(targetUserId)) {
                return res.status(400).json({ message: "Cannot demote the only admin left" });
            }
            updateQuery = { $pull: { groupAdmins: targetUserId } };
        }

        const updatedGroup = await Conversation.findByIdAndUpdate(groupId, updateQuery, { new: true })
            .populate("participants", "-password")
            .populate("groupAdmins", "-password");

        res.status(200).json({ success: true, conversation: updatedGroup });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const userName = req.user.name;

        let group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        group.participants = group.participants.filter(p => p.toString() !== userId);
        group.groupAdmins = group.groupAdmins.filter(a => a.toString() !== userId);

        if (group.participants.length === 0) {
            await Conversation.findByIdAndDelete(groupId);
            await Message.deleteMany({ conversation: groupId });
            return res.status(200).json({ success: true, message: "Group deleted" });
        }

        if (group.groupAdmins.length === 0) {
            group.groupAdmins.push(group.participants[0]);
        }

        const systemMessage = await Message.create({
            conversation: groupId,
            sender: userId,
            content: `${userName} left the group`,
            isSystemMessage: true,
            readBy: group.participants 
        });

        group.lastMessage = systemMessage._id; 
        await group.save();

        const updatedGroup = await Conversation.findById(groupId)
            .populate("participants", "-password")
            .populate("groupAdmins", "-password");

        res.status(200).json({ success: true, conversation: updatedGroup });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};