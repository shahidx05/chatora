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

const replyToSchema = new mongoose.Schema({
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    senderName: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    preview: { type: String, maxlength: 100, default: '' },
    deleted: { type: Boolean, default: false }
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

    replyTo: {
        type: replyToSchema,
        default: undefined
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: undefined
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

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
