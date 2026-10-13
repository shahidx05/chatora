const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    url: String,
    publicId: String,
    resourceType: { type: String, enum: ['image', 'raw'] },
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    originalName: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
    },
    caption: {
        type: String,
        default: ''
    },
    attachment: {
        type: attachmentSchema,
        default: undefined
    },
    clientMsgId: {
        type: String,
        maxlength: 64
    },
    isSystemMessage: {
        type: Boolean,
        default: false
    },

    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    deliveredTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent'
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
