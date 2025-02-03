const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { isAuthenticated, isGuest } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const Session = require('../models/Session');

// Home page
router.get('/', (req, res) => {
    res.render('home');
});

// Login routes
router.get('/login', isGuest, (req, res) => {
    res.render('auth/login');
});

router.post('/login', isGuest, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.render('auth/login', {
                error: 'Invalid credentials'
            });
        }

        req.session.userId = user._id;
        res.redirect('/dashboard');
    } catch (error) {
        res.render('auth/login', {
            error: 'An error occurred'
        });
    }
});

// Register routes
router.get('/register', isGuest, (req, res) => {
    res.render('auth/register');
});

router.post('/register', isGuest, async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('auth/register', {
                error: 'Passwords do not match'
            });
        }

        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.render('auth/register', {
                error: 'Username or email already exists'
            });
        }

        // Generate UUID without hyphens
        const uuid = uuidv4().replace(/-/g, '');

        const user = new User({
            username,
            email,
            password,
            uuid
        });

        await user.save();
        req.session.userId = user._id;
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            error: 'An error occurred'
        });
    }
});

// Dashboard routes
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('dashboard/index', { user });
    } catch (error) {
        res.redirect('/login');
    }
});

// Profile routes
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('profile/index', { user });
    } catch (error) {
        res.redirect('/dashboard');
    }
});

// Profile update route
router.post('/profile/update', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { email, password, confirmPassword } = req.body;

        // Update email
        user.email = email;

        // Update password if provided
        if (password && password === confirmPassword) {
            user.password = password;
        }

        await user.save();
        res.redirect('/profile');
    } catch (error) {
        res.redirect('/profile');
    }
});

// Logout route
router.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Add this route for testing texture access
router.get('/test-texture', (req, res) => {
    const texturesDir = path.join(process.cwd(), 'public', 'textures');
    const files = fs.readdirSync(texturesDir);
    
    res.json({
        texturesDirectory: texturesDir,
        files: files,
        exists: fs.existsSync(texturesDir),
        stats: fs.statSync(texturesDir),
        testUrls: files.map(file => `${process.env.DOMAIN}/textures/${file}`)
    });
});

// Add account deletion route
router.post('/profile/delete', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        // Delete user's textures
        if (user.skin) {
            const skinPath = path.join(process.cwd(), 'public', 'textures', user.skin);
            if (fs.existsSync(skinPath)) {
                fs.unlinkSync(skinPath);
            }
        }
        if (user.cape) {
            const capePath = path.join(process.cwd(), 'public', 'textures', user.cape);
            if (fs.existsSync(capePath)) {
                fs.unlinkSync(capePath);
            }
        }

        // Delete sessions
        await Session.deleteMany({ uuid: user.uuid });
        
        // Delete user
        await User.findByIdAndDelete(req.session.userId);
        
        // Destroy session
        req.session.destroy();
        
        res.status(200).send();
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router; 