const express = require('express');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

dotenv.config();

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Routes
app.use('/', require('./routes/web'));
app.use('/api/yggdrasil', require('./routes/yggdrasil'));
app.use('/textures', express.static(path.join(__dirname, 'public', 'textures'), {
    setHeaders: (res, path) => {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', '*');
    }
}));
app.use('/api/textures', require('./routes/textures'));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 