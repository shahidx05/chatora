const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    isGroup: {
        type: Boolean,
        default: false,
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    groupName: {
        type: String,
        trim: true,
    },
    groupDescription: {
        type: String,
        default: ""
    },
    groupAdmins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },
    lastRead: {
        type: Map,
        of: mongoose.Schema.Types.ObjectId,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);