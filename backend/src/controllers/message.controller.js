const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { toClient } = require('../services/receipts.service');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// GET /api/messages/:conversationId?before=<messageId>&limit=30
// Cursor pagination, oldest -> newest. Each message carries its status and
// delivered/read counts (not the full id arrays).
// Messages where deletedFor contains req.user.id are excluded.
// Messages where isDeleted=true are included (as a placeholder).
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { before } = req.query;

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation' });
        }
        if (before !== undefined && !mongoose.isValidObjectId(before)) {
            return res.status(400).json({ success: false, message: 'Invalid cursor' });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

        // membership check and member list in one query
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user.id
        }).select('participants').lean();

        if (!conversation) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const memberIds = conversation.participants.map(String);

        const filter = {
            conversation: conversationId,
            // exclude messages deleted for this user (scope='me')
            deletedFor: { $ne: req.user.id }
        };
        if (before) filter._id = { $lt: before };

        // fetch one extra row: if it exists, there is another page
        const rows = await Message.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate('sender', '-password')
            .lean();

        const hasMore = rows.length > limit;
        const messages = (hasMore ? rows.slice(0, limit) : rows)
            .reverse()
            .map(m => toClient(m, memberIds));

        res.status(200).json({
            success: true,
            messages,
            hasMore,
            nextCursor: messages.length ? messages[0]._id : null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
