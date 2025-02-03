const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Create keys directory if it doesn't exist
const keysDir = path.join(process.cwd(), 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

// Generate key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// Save keys to files
fs.writeFileSync(path.join(keysDir, 'public.key'), publicKey);
fs.writeFileSync(path.join(keysDir, 'private.key'), privateKey);

console.log('RSA key pair generated successfully!');
console.log('Public key saved to: keys/public.key');
console.log('Private key saved to: keys/private.key'); 