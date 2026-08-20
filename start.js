const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine execution root
const currentDir = __dirname;
const targetFolderName = 'pgwiz-md-litrop';
const targetDir = path.join(currentDir, targetFolderName);
const repoUrl = 'https://github.com/pgwiz/pgwiz-md-litrop.git';

let botIndexFile = path.join(currentDir, 'index.js');

if (fs.existsSync(targetDir)) {
    console.log(`✅ Directory '${targetFolderName}' already exists! Proceeding to use existing index.js...`);
    botIndexFile = path.join(targetDir, 'index.js');
} else if (fs.existsSync(path.join(currentDir, 'pgwiz-md-litrop', 'index.js'))) {
    console.log(`✅ Found 'pgwiz-md-litrop/index.js'! Proceeding to start...`);
    botIndexFile = path.join(currentDir, 'pgwiz-md-litrop', 'index.js');
} else if (!fs.existsSync(botIndexFile)) {
    console.log(`📥 Cloned directory not found. Cloning ${repoUrl}...`);
    try {
        execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
        botIndexFile = path.join(targetDir, 'index.js');
    } catch (err) {
        console.error('❌ Failed to clone repository:', err.message);
    }
}

// Verify node_modules in target directory
const botDir = path.dirname(botIndexFile);
const nodeModulesPath = path.join(botDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log(`📦 'node_modules' missing in ${botDir}. Installing dependencies...`);
    try {
        execSync('npm install --legacy-peer-deps', { stdio: 'inherit', cwd: botDir });
        console.log('✅ Dependencies installed successfully!');
    } catch (err) {
        console.error('❌ Error during npm install:', err.message);
    }
}

console.log(`🚀 Launching PGWIZ-MD Bot from: ${botIndexFile}`);
require(botIndexFile);
