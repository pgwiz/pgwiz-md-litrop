const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OPTIONAL_DIR = path.join(ROOT, 'plugins-optional');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

function extractCategory(source) {
  const match = source.match(/category\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (!match) return 'misc';
  return match[1].toLowerCase();
}

function buildIndex() {
  if (!fs.existsSync(OPTIONAL_DIR)) {
    return null;
  }

  const files = fs.readdirSync(OPTIONAL_DIR).filter(file => file.endsWith('.js'));
  const packs = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(OPTIONAL_DIR, file), 'utf8');
      const category = extractCategory(content);
      if (!packs[category]) packs[category] = [];
      packs[category].push(file);
    } catch (e) {
      if (!packs.misc) packs.misc = [];
      packs.misc.push(file);
    }
  }

  return { files, packs };
}

function installFiles(files) {
  let installed = 0;
  let skipped = 0;

  for (const file of files) {
    const src = path.join(OPTIONAL_DIR, file);
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

  const result = installFiles(files);
  console.log(`Installed ${result.installed}/${result.total} plugins (skipped ${result.skipped}).`);
}

main();
