const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoUrl = process.argv[2] || (fs.existsSync(path.join(__dirname, 'package.json')) && require('./package.json').name === 'pgwiz-md' ? 'https://github.com/pgwiz/pgwiz-md-litrop.wiki.git' : 'https://github.com/pgwiz/pgwiz-md-litrop.wiki.git');
const wikiDocsDir = path.join(__dirname, 'docs/wiki');
const tmpDir = path.join(__dirname, '.tmp_wiki');

console.log('🚀 Synchronizing Git Wiki for:', repoUrl);

if (!fs.existsSync(wikiDocsDir)) {
    console.error('❌ docs/wiki directory not found!');
    process.exit(1);
}

try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    
    console.log('Cloning remote wiki repo...');
    execSync(`git clone ${repoUrl} ${tmpDir}`, { stdio: 'inherit' });

    console.log('Copying wiki markdown files...');
    for (const f of fs.readdirSync(wikiDocsDir)) {
        fs.copyFileSync(path.join(wikiDocsDir, f), path.join(tmpDir, f));
    }

    console.log('Committing and pushing wiki...');
    execSync(`git add -A && git commit -m "docs(wiki): update complete command reference and guides" && git push origin master`, {
        cwd: tmpDir,
        stdio: 'inherit'
    });

    console.log('✅ Git Wiki successfully synchronized!');
} catch (e) {
    console.log('ℹ️ If remote wiki repo is not yet initialized, click "Create the first page" on your GitHub Wiki tab, then rerun this script.');
} finally {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}
