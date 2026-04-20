const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const OPTIONAL_DIR = path.join(ROOT, 'plugins-optional');
const MODEPACK_CACHE_DIR = path.join(ROOT, 'data', 'modepacks-cache');
const MODEPACK_REPO = process.env.MODEPACK_REPO || 'https://github.com/pgwiz/litrop-plugins.git';
const PLUGINS_DIR = path.join(ROOT, 'plugins');

function ensureOptionalDir() {
  if (fs.existsSync(OPTIONAL_DIR)) {
    return OPTIONAL_DIR;
  }

  try {
    if (fs.existsSync(path.join(MODEPACK_CACHE_DIR, '.git'))) {
      execSync('git pull --ff-only', { cwd: MODEPACK_CACHE_DIR, stdio: 'ignore' });
    } else {
      fs.mkdirSync(path.dirname(MODEPACK_CACHE_DIR), { recursive: true });
      execSync(`git clone ${MODEPACK_REPO} "${MODEPACK_CACHE_DIR}"`, { stdio: 'ignore' });
    }

    const remoteOptionalDir = path.join(MODEPACK_CACHE_DIR, 'plugins-optional');
    return fs.existsSync(remoteOptionalDir) ? remoteOptionalDir : null;
  } catch (error) {
    console.error(`Failed to fetch modepacks from ${MODEPACK_REPO}:`, error.message);
    return null;
  }
}

function extractCategory(source) {
  const match = source.match(/category\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (!match) return 'misc';
  return match[1].toLowerCase();
}

function buildIndex() {
  const sourceDir = ensureOptionalDir();
  if (!sourceDir) {
    return null;
  }

  const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.js'));
  const packs = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(sourceDir, file), 'utf8');
      const category = extractCategory(content);
      if (!packs[category]) packs[category] = [];
      packs[category].push(file);
    } catch (e) {
      if (!packs.misc) packs.misc = [];
      packs.misc.push(file);
    }
  }

  return { files, packs, sourceDir };
}

function installFiles(files, sourceDir) {
  let installed = 0;
  let skipped = 0;

  for (const file of files) {
    const src = path.join(sourceDir, file);
    const dest = path.join(PLUGINS_DIR, file);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dest);
    installed++;
  }

  return { installed, skipped, total: files.length };
}

function main() {
  const index = buildIndex();
  if (!index) {
    console.error('plugins-optional directory not found.');
    process.exit(1);
  }

  const arg = (process.argv[2] || '').toLowerCase();
  if (!arg) {
    const categories = Object.keys(index.packs).sort().join(', ');
    console.log('Usage: node install-plugins.js <category|all>');
    console.log(`Available categories: ${categories}`);
    return;
  }

  const files = arg === 'all' ? index.files : index.packs[arg];
  if (!files || files.length === 0) {
    const categories = Object.keys(index.packs).sort().join(', ');
    console.error(`Unknown category "${arg}". Available categories: ${categories}`);
    process.exit(1);
  }

  const result = installFiles(files, index.sourceDir);
  console.log(`Installed ${result.installed}/${result.total} plugins (skipped ${result.skipped}).`);
}

main();
