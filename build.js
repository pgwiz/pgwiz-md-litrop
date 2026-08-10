// build.js - RAW MODE (no obfuscation)
const fs = require('fs');
const path = require('path');

const tasks = [
    { src: 'index_raw.js', dest: 'index.js' },
    { src: path.join('lib', 'messageHandler_raw.js'), dest: path.join('lib', 'messageHandler.js') },
];

let built = 0, errors = 0;

for (const { src, dest } of tasks) {
    const label = src.includes('messageHandler') ? 'handler' : 'index';
    const srcPath = path.resolve(__dirname, src);
    const destPath = path.resolve(__dirname, dest);
    try {
        const content = fs.readFileSync(srcPath, 'utf8');
        fs.writeFileSync(destPath, content, 'utf8');
        const kb = (Buffer.byteLength(content) / 1024).toFixed(1);
        console.log(`📋 ${label}: ${src} → ${dest} (${kb}KB, raw copy)`);
        built++;
    } catch (e) {
        console.error(`❌ Error processing ${src}: ${e.message}`);
        errors++;
    }
}

console.log(`\n📦 Build complete: ${built} copied, ${errors} errors (obfuscation disabled)`);
