const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// GET /api/messages/:conversationId?before=<messageId>&limit=30
// Cursor pagination: returns the newest page when `before` is omitted, otherwise
// the page of messages older than `before`. Messages come back oldest -> newest
// so the client can render them as they are.
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

        const isMember = await Conversation.exists({
            _id: conversationId,
            participants: req.user.id
        });

        if (!isMember) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const filter = { conversation: conversationId };
        if (before) filter._id = { $lt: before };

        // fetch one extra row: if it exists, there is another page (no count query needed)
        const rows = await Message.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate('sender', '-password');

        const hasMore = rows.length > limit;
        const messages = (hasMore ? rows.slice(0, limit) : rows).reverse();

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
