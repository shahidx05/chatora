const Conversation = require('../models/Conversation');
const User = require("../models/User")
const Message = require("../models/Message")

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
            groupAdmins: [req.user.id],
            participants: allParticipants
        });

        res.status(201).json({
            success: true,
            groupId: groupChat._id,
            isGroup: groupChat.isGroup,
            groupName: groupChat.groupName,
            groupAdmins: groupChat.groupAdmins,
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

        const admin = await User.findById(req.user.id);
        const adminName = admin ? admin.name : "A member";

        if (!newMembers || newMembers.length === 0) {
            return res.status(400).json({ message: "No members provided to add" });
        }

        const group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (!group.groupAdmins.some(adminId => adminId.toString() === String(req.user.id))) {
            return res.status(403).json({ message: "Only admins can perform this action" });
        }

        const updatedGroup = await Conversation.findByIdAndUpdate(
            groupId,
            {
                $addToSet: { participants: { $each: newMembers } }
            },
            { new: true }
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
        if (!group) return res.status(404).json({ message: "Group not found" });

        // FIX: Safe Admin Check
        if (!group.groupAdmins.some(adminId => adminId.toString() === String(req.user.id))) {
            return res.status(403).json({ message: "Only admins can perform this action" });
        }

        // Fetch Names for System Message
        const admin = await User.findById(req.user.id);
        const adminName = admin ? admin.name : "Admin";

        const removedUser = await User.findById(userIdToRemove);
        const removedName = removedUser ? removedUser.name : "A member";

        const updatedGroup = await Conversation.findByIdAndUpdate(
            groupId,
            {
                $pull: { participants: userIdToRemove, groupAdmins: userIdToRemove }
            },
            { new: true }
        );

        // CREATE SYSTEM MESSAGE
        const systemMessage = await Message.create({
            conversation: groupId,
            sender: req.user.id,
            content: `${adminName} removed ${removedName}`,
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

exports.updateGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { groupName, groupDescription } = req.body;

        const group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        // FIX: Safe Admin Check
        if (!group.groupAdmins.some(adminId => adminId.toString() === String(req.user.id))) {
            return res.status(403).json({ message: "Only admins can update group info" });
        }

        // Fetch Admin Name
        const admin = await User.findById(req.user.id);
        const adminName = admin ? admin.name : "Admin";

        // Logic to determine what exactly changed for the message
        let actionText = "changed the group info";
        if (groupName && groupDescription !== undefined) actionText = `changed the group name to "${groupName}" and updated description`;
        else if (groupName) actionText = `changed the group name to "${groupName}"`;
        else if (groupDescription !== undefined) actionText = `changed the group description`;

        if (groupName) group.groupName = groupName;
        if (groupDescription !== undefined) group.groupDescription = groupDescription;

        // CREATE SYSTEM MESSAGE
        const systemMessage = await Message.create({
            conversation: groupId,
            sender: req.user.id,
            content: `${adminName} ${actionText}`,
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

exports.manageAdmin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { targetUserId, action } = req.body;

        const group = await Conversation.findById(groupId);
        if (!group) return res.status(404).json({ message: "Group not found" });

        // FIX: Safe Admin Check
        if (!group.groupAdmins.some(adminId => adminId.toString() === String(req.user.id))) {
            return res.status(403).json({ message: "Only admins can manage roles" });
        }

        // Fetch Names
        const admin = await User.findById(req.user.id);
        const adminName = admin ? admin.name : "Admin";

        const targetUser = await User.findById(targetUserId);
        const targetName = targetUser ? targetUser.name : "A member";

        let updateQuery = {};
        let actionText = "";

        if (action === 'promote') {
            updateQuery = { $addToSet: { groupAdmins: targetUserId } };
            actionText = `made ${targetName} an admin`;
        } else if (action === 'demote') {
            if (group.groupAdmins.length === 1 && group.groupAdmins.includes(targetUserId)) {
                return res.status(400).json({ message: "Cannot demote the only admin left" });
            }
            updateQuery = { $pull: { groupAdmins: targetUserId } };
            actionText = `removed ${targetName} as admin`;
        }

        const updatedGroup = await Conversation.findByIdAndUpdate(groupId, updateQuery, { new: true });

        // CREATE SYSTEM MESSAGE
        const systemMessage = await Message.create({
            conversation: groupId,
            sender: req.user.id,
            content: `${adminName} ${actionText}`,
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

exports.leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        const userName = user ? user.name : "A member";

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