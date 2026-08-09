/**
 * PGWIZ-MD Build Script
 * Obfuscates raw source files into deployable compiled files.
 * 
 * Usage:
 *   node build.js              — build all files
 *   node build.js index        — build index only
 *   node build.js handler      — build messageHandler only
 */

// Use global install if local not found
let JavaScriptObfuscator;
try {
  JavaScriptObfuscator = require('javascript-obfuscator');
} catch (e) {
  const globalPath = require('path').join(
    require('os').homedir(),
    'AppData', 'Roaming', 'npm', 'node_modules', 'javascript-obfuscator'
  );
  JavaScriptObfuscator = require(globalPath);
}
const fs = require('fs');
const path = require('path');

const OBFUSCATE_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  shuffleStringArray: true,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: [],
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false
};

const TARGETS = [
  {
    src: 'index_raw.js',
    out: 'index.js',
    label: 'index'
  },
  {
    src: path.join('lib', 'messageHandler_raw.js'),
    out: path.join('lib', 'messageHandler.js'),
    label: 'handler'
  }
];

const args = process.argv.slice(2);
const filter = args[0]; // optional: 'index' or 'handler'

let built = 0;
let errors = 0;

for (const target of TARGETS) {
  if (filter && target.label !== filter) continue;

  const srcPath = path.resolve(__dirname, target.src);
  const outPath = path.resolve(__dirname, target.out);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️  Source not found, skipping: ${target.src}`);
    continue;
  }

  try {
    console.log(`🔨 Building ${target.label}: ${target.src} → ${target.out}`);
    const source = fs.readFileSync(srcPath, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATE_OPTIONS);
    fs.writeFileSync(outPath, result.getObfuscatedCode(), 'utf8');
    const inKB = (source.length / 1024).toFixed(1);
    const outKB = (result.getObfuscatedCode().length / 1024).toFixed(1);
    console.log(`✅ ${target.label}: ${inKB}KB → ${outKB}KB (obfuscated)`);
    built++;
  } catch (e) {
    console.error(`❌ Failed to build ${target.label}: ${e.message}`);
    errors++;
  }
}

console.log(`\n📦 Build complete: ${built} built, ${errors} errors`);
if (errors > 0) process.exit(1);
