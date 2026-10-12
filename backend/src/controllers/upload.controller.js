const crypto = require('node:crypto');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const Conversation = require('../models/Conversation');
const { MIME_RULES } = require('../config/uploadRules');

// POST /api/uploads/sign
// body: { conversationId, mime, size }
// The file never touches our server: the client uploads straight to Cloudinary
// using this short-lived signature.
exports.signUpload = async (req, res) => {
    try {
        const { conversationId, mime, size } = req.body || {};

        if (!mongoose.isValidObjectId(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation' });
        }

        const rule = MIME_RULES[mime];
        if (!rule) {
            return res.status(400).json({ success: false, message: 'File type not allowed' });
        }
        if (!Number.isInteger(size) || size <= 0 || size > rule.maxBytes) {
            return res.status(400).json({
                success: false,
                message: `File too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB)`
            });
        }

        const isMember = await Conversation.exists({
            _id: conversationId,
            participants: req.user.id
        });
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'Not a member of this conversation' });
        }

        // server picks the name: unguessable, client cannot overwrite other files
        const publicId =
            `chatora/${conversationId}/${crypto.randomUUID()}` +
            (rule.resourceType === 'raw' ? `.${rule.ext}` : '');

        const timestamp = Math.round(Date.now() / 1000);
        const signature = cloudinary.utils.api_sign_request(
            { public_id: publicId, timestamp },
            process.env.CLOUDINARY_API_SECRET
        );

        res.json({
            success: true,
            uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${rule.resourceType}/upload`,
            apiKey: process.env.CLOUDINARY_API_KEY,
            timestamp,
            signature,
            publicId,
            resourceType: rule.resourceType
        });
    } catch (err) {
        console.error('signUpload failed:', err.message);
        res.status(500).json({ success: false, message: 'Could not prepare upload' });
    }
};
