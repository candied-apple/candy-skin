const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// Create textures directory if it doesn't exist
const texturesDir = path.join(process.cwd(), 'public', 'textures');
if (!fs.existsSync(texturesDir)) {
    fs.mkdirSync(texturesDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, texturesDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

router.post('/upload/skin', upload.single('skin'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Skin upload request:', {
            file: req.file,
            body: req.body
        });

        const image = sharp(req.file.path);
        const metadata = await image.metadata();
        console.log('Skin image metadata:', metadata);

        // Validate skin dimensions
        if (metadata.width !== 64 || (metadata.height !== 64 && metadata.height !== 32)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Invalid skin dimensions' });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old skin if exists
        if (user.skin) {
            const oldSkinPath = path.join(texturesDir, user.skin);
            if (fs.existsSync(oldSkinPath)) {
                fs.unlinkSync(oldSkinPath);
            }
        }

        // Update both skin file and model
        user.skin = req.file.filename;
        user.skinModel = req.body.model || 'steve'; // Default to 'steve' if not specified
        await user.save();

        console.log('Skin uploaded successfully:', {
            userId: user._id,
            username: user.username,
            skinFile: user.skin,
            skinModel: user.skinModel,
            skinPath: path.join(texturesDir, user.skin)
        });

        res.json({ 
            message: 'Skin uploaded successfully',
            skinUrl: `${process.env.DOMAIN}/textures/${user.skin}`,
            skinModel: user.skinModel
        });
    } catch (error) {
        console.error('Skin upload error:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/upload/cape', upload.single('cape'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const image = sharp(req.file.path);
        const metadata = await image.metadata();

        // Validate cape dimensions
        if (metadata.width !== 64 || metadata.height !== 32) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Invalid cape dimensions' });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old cape if exists
        if (user.cape) {
            const oldCapePath = path.join(texturesDir, user.cape);
            if (fs.existsSync(oldCapePath)) {
                fs.unlinkSync(oldCapePath);
            }
        }

        user.cape = req.file.filename;
        await user.save();

        res.json({ message: 'Cape uploaded successfully' });
    } catch (error) {
        // Clean up uploaded file if there's an error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Cape upload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update the texture serving route
router.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'public', 'textures', filename);
    
    console.log('Texture request:', {
        filename,
        filePath,
        exists: fs.existsSync(filePath),
        headers: req.headers,
        url: req.url,
        fullUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
        method: req.method
    });
    
    if (fs.existsSync(filePath)) {
        // Read file stats
        const stats = fs.statSync(filePath);
        console.log('Texture file stats:', {
            filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        });

        // Set appropriate headers for caching and content type
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Length', stats.size);
        
        // Stream the file
        const stream = fs.createReadStream(filePath);
        stream.on('error', (error) => {
            console.error('Error streaming texture file:', error);
            res.status(500).send('Error sending texture file');
        });
        
        stream.pipe(res);
        
        // Log when the stream finishes
        stream.on('end', () => {
            console.log('Texture file sent successfully:', filename);
        });
    } else {
        console.error('Texture file not found:', {
            filePath,
            searchedIn: process.cwd(),
            fullPath: path.resolve(filePath)
        });
        res.status(404).send('Texture not found');
    }
});

// Add a test endpoint
router.get('/test/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'public', 'textures', filename);
    
    res.json({
        filename,
        exists: fs.existsSync(filePath),
        filePath,
        stats: fs.existsSync(filePath) ? fs.statSync(filePath) : null,
        url: `${process.env.DOMAIN}/textures/${filename}`,
        directory: {
            current: process.cwd(),
            textures: path.join(process.cwd(), 'public', 'textures'),
            files: fs.readdirSync(path.join(process.cwd(), 'public', 'textures'))
        }
    });
});

// Add these routes for removing textures
router.post('/remove/skin', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.skin) {
            const skinPath = path.join(texturesDir, user.skin);
            if (fs.existsSync(skinPath)) {
                fs.unlinkSync(skinPath);
            }
            user.skin = null;
            await user.save();
        }

        res.json({ message: 'Skin removed successfully' });
    } catch (error) {
        console.error('Remove skin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/remove/cape', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.cape) {
            const capePath = path.join(texturesDir, user.cape);
            if (fs.existsSync(capePath)) {
                fs.unlinkSync(capePath);
            }
            user.cape = null;
            await user.save();
        }

        res.json({ message: 'Cape removed successfully' });
    } catch (error) {
        console.error('Remove cape error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 