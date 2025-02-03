const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    uuid: {
        type: String,
        required: true,
        unique: true
    },
    skin: {
        type: String,
        default: null
    },
    cape: {
        type: String,
        default: null
    },
    skinModel: {
        type: String,
        enum: ['steve', 'alex'],
        default: 'steve'
    }
});

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    
    if (this.isModified('username')) {
        this.username = this.username.toLowerCase();
    }
    
    next();
});

userSchema.index({ username: 1 }, { 
    unique: true,
    collation: { locale: 'en', strength: 2 }
});

module.exports = mongoose.model('User', userSchema); 