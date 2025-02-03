const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Session = require('../models/Session');

// Load keys
const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.key'), 'utf8');
const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.key'), 'utf8');

// Metadata endpoint - GET /api/yggdrasil
router.get('/', (req, res) => {
    // Extract domain without protocol
    const domain = process.env.DOMAIN.replace('http://', '').replace('https://', '');
    
    res.json({
        meta: {
            serverName: "Candy Skin Server",
            implementationName: "candyskin",
            implementationVersion: "1.0.0"
        },
        skinDomains: [domain],
        signaturePublickey: publicKey
    });
});

// Authentication endpoint - POST /api/yggdrasil/authserver/authenticate
router.post('/authserver/authenticate', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(403).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials"
            });
        }

        const accessToken = jwt.sign(
            { 
                sub: user.uuid,
                name: user.username,
                spr: crypto.randomBytes(16).toString('hex')
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            accessToken,
            clientToken: req.body.clientToken || crypto.randomBytes(16).toString('hex'),
            availableProfiles: [{
                id: user.uuid,
                name: user.username,
                legacy: false
            }],
            selectedProfile: {
                id: user.uuid,
                name: user.username,
                legacy: false
            },
            user: {
                id: user.uuid,
                properties: []
            }
        });
    } catch (error) {
        res.status(500).json({
            error: "InternalErrorException",
            errorMessage: "Internal server error"
        });
    }
});

// Refresh token endpoint
router.post('/authserver/refresh', async (req, res) => {
    try {
        const { accessToken, clientToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token"
            });
        }

        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        const user = await User.findOne({ uuid: decoded.sub });

        if (!user) {
            return res.status(403).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token"
            });
        }

        const newAccessToken = jwt.sign(
            { 
                sub: user.uuid,
                name: user.username,
                spr: crypto.randomBytes(16).toString('hex')
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            accessToken: newAccessToken,
            clientToken: clientToken || crypto.randomBytes(16).toString('hex'),
            selectedProfile: {
                id: user.uuid,
                name: user.username
            }
        });
    } catch (error) {
        res.status(403).json({
            error: "ForbiddenOperationException",
            errorMessage: "Invalid token"
        });
    }
});

// Validate token endpoint
router.post('/authserver/validate', async (req, res) => {
    try {
        const { accessToken } = req.body;
        jwt.verify(accessToken, process.env.JWT_SECRET);
        res.status(204).send();
    } catch (error) {
        res.status(403).json({
            error: "ForbiddenOperationException",
            errorMessage: "Invalid token"
        });
    }
});

// Invalidate token endpoint
router.post('/authserver/invalidate', (req, res) => {
    res.status(204).send();
});

// Signout endpoint
router.post('/authserver/signout', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(403).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid credentials"
            });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            error: "InternalErrorException",
            errorMessage: "Internal server error"
        });
    }
});

// Profile endpoint with signature generation
router.get('/sessionserver/session/minecraft/profile/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid.toLowerCase().replace(/-/g, '');
        console.log('Profile request for UUID:', uuid);

        const user = await User.findOne({ uuid });
        if (!user) {
            console.log('No user found for UUID:', uuid);
            return res.status(204).send();
        }

        const textures = {
            timestamp: Date.now(),
            profileId: user.uuid,
            profileName: user.username,
            textures: {}
        };

        if (user.skin) {
            const skinUrl = `${process.env.DOMAIN}/textures/${user.skin}`;
            console.log('Generated skin URL:', {
                url: skinUrl,
                exists: fs.existsSync(path.join(process.cwd(), 'public', 'textures', user.skin)),
                absolutePath: path.resolve(path.join(process.cwd(), 'public', 'textures', user.skin))
            });
            
            textures.textures.SKIN = {
                url: skinUrl,
                metadata: {
                    model: user.skinModel === 'alex' ? 'slim' : 'default'
                }
            };
        }

        if (user.cape) {
            textures.textures.CAPE = {
                url: `${process.env.DOMAIN}/textures/${user.cape}`
            };
        }

        const texturesBase64 = Buffer.from(JSON.stringify(textures)).toString('base64');
        
        // Generate signature
        const sign = crypto.createSign('SHA1');
        sign.write(texturesBase64);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');

        const response = {
            id: user.uuid,
            name: user.username,
            properties: [{
                name: "textures",
                value: texturesBase64,
                signature: signature
            }]
        };

        const decodedTextures = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        console.log('Full decoded texture data:', {
            textures: decodedTextures,
            skinExists: user.skin ? fs.existsSync(path.join(process.cwd(), 'public', 'textures', user.skin)) : false,
            skinPath: user.skin ? path.join(process.cwd(), 'public', 'textures', user.skin) : null
        });
        res.json(response);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Join server endpoint
router.post('/sessionserver/session/minecraft/join', async (req, res) => {
    try {
        const { accessToken, selectedProfile: uuid, serverId } = req.body;
        console.log('Join request:', { uuid, serverId });

        // Verify the access token
        let decoded;
        try {
            decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        } catch (error) {
            console.error('Token verification failed:', error);
            return res.status(403).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid token"
            });
        }

        // Find the user
        const user = await User.findOne({ 
            uuid: uuid.toLowerCase().replace(/-/g, '') 
        });

        if (!user) {
            console.error('User not found:', uuid);
            return res.status(403).json({
                error: "ForbiddenOperationException",
                errorMessage: "Invalid profile"
            });
        }

        // Delete any existing sessions for this user
        await Session.deleteMany({ uuid: user.uuid });

        // Create new session
        const session = new Session({
            accessToken,
            uuid: user.uuid,
            username: user.username,
            serverId: serverId
        });

        await session.save();
        console.log('Session created:', session);

        res.status(204).send();
    } catch (error) {
        console.error('Join error:', error);
        res.status(500).json({
            error: "InternalErrorException",
            errorMessage: "Internal server error"
        });
    }
});

// Has joined server endpoint
router.get('/sessionserver/session/minecraft/hasJoined', async (req, res) => {
    try {
        const { username, serverId } = req.query;
        console.log('hasJoined request:', { username, serverId });

        // Find the active session
        const session = await Session.findOne({ 
            username: username.toLowerCase(),
            serverId: serverId
        });

        console.log('Found session:', session);

        if (!session) {
            console.log('No session found for:', { username, serverId });
            return res.status(204).send();
        }

        // Find the user
        const user = await User.findOne({ uuid: session.uuid });
        if (!user) {
            console.log('No user found for session:', session);
            return res.status(204).send();
        }

        // Generate the response with textures - Using same format as profile endpoint
        const textures = {
            timestamp: Date.now(),
            profileId: user.uuid,
            profileName: user.username,
            textures: {}
        };

        if (user.skin) {
            const skinUrl = `${process.env.DOMAIN}/textures/${user.skin}`;
            console.log('Generated skin URL:', {
                url: skinUrl,
                exists: fs.existsSync(path.join(process.cwd(), 'public', 'textures', user.skin)),
                absolutePath: path.resolve(path.join(process.cwd(), 'public', 'textures', user.skin))
            });
            
            textures.textures.SKIN = {
                url: skinUrl,
                metadata: {
                    model: user.skinModel === 'alex' ? 'slim' : 'default'
                }
            };
        }

        if (user.cape) {
            textures.textures.CAPE = {
                url: `${process.env.DOMAIN}/textures/${user.cape}`
            };
        }

        const texturesBase64 = Buffer.from(JSON.stringify(textures)).toString('base64');
        
        // Generate signature
        const sign = crypto.createSign('SHA1');
        sign.write(texturesBase64);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');

        const response = {
            id: user.uuid,
            name: user.username,
            properties: [{
                name: "textures",
                value: texturesBase64,
                signature: signature
            }]
        };

        const decodedTextures = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        console.log('Full decoded texture data:', {
            textures: decodedTextures,
            skinExists: user.skin ? fs.existsSync(path.join(process.cwd(), 'public', 'textures', user.skin)) : false,
            skinPath: user.skin ? path.join(process.cwd(), 'public', 'textures', user.skin) : null
        });
        res.json(response);
    } catch (error) {
        console.error('HasJoined error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router; 