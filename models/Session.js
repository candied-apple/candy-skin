const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    accessToken: {
        type: String,
        required: true
    },
    uuid: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true,
        set: v => v.toLowerCase(),
        index: true
    },
    serverId: {
        type: String,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 5 minutes
    }
});

// Compound indexes for faster lookups
sessionSchema.index({ username: 1, serverId: 1 });
sessionSchema.index({ uuid: 1, serverId: 1 });

module.exports = mongoose.model('Session', sessionSchema); 