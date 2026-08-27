const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
      resolve((stdout || '').toString());
    });
  });
}

async function hasGitRepo() {
  const gitDir = path.join(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      await run('git init');
      await run('git remote add origin https://github.com/pgwiz/pgwiz-md-litrop.git').catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  try {
    await run('git --version');
    return true;
  } catch {
    return false;
  }
}

async function isHerokuEnv() {
  return !!process.env.DYNO || !!process.env.HEROKU_APP_NAME;
}

async function updateViaGit() {
  await run('git remote set-url origin https://github.com/pgwiz/pgwiz-md-litrop.git').catch(() => { });
  const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
  await run('git fetch --all --prune');
  const newRev = (await run('git rev-parse origin/main')).trim();
  const alreadyUpToDate = oldRev === newRev;
  const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
  const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev}..${newRev}`).catch(() => '');
  await run(`git reset --hard ${newRev}`);
  await run('git clean -fd -e session -e .env -e store.json -e session/ -e baileys_store.db');

  return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
  return new Promise((resolve, reject) => {
    try {
      if (visited.has(url) || visited.size > 5) {
        return reject(new Error('Too many redirects'));
      }
      visited.add(url);

      const useHttps = url.startsWith('https://');
      const client = useHttps ? require('https') : require('http');
      const req = client.get(url, {
        headers: {
          'User-Agent': 'MegaBot-Updater/1.0',
          'Accept': '*/*'
        }
      }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const location = res.headers.location;
          if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
          const nextUrl = new URL(location, url).toString();
          res.resume();
          return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', err => {
          try { file.close(() => { }); } catch { }
          fs.unlink(dest, () => reject(err));
        });
      });
      req.on('error', err => {
        fs.unlink(dest, () => reject(err));
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function extractZip(zipPath, outDir) {
  if (process.platform === 'win32') {
    const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
    await run(cmd);
    return;
  }
  try {
    await run('command -v unzip');
    await run(`unzip -o '${zipPath}' -d '${outDir}'`);
    return;
  } catch { }
  try {
    await run('command -v 7z');
    await run(`7z x -y '${zipPath}' -o'${outDir}'`);
    return;
  } catch { }
  try {
    await run('busybox unzip -h');
    await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
    return;
  } catch { }
  throw new Error("No system unzip tool found (unzip/7z/busybox).");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (ignore.includes(entry)) continue;
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.lstatSync(s);
    if (stat.isDirectory()) {
      copyRecursive(s, d, ignore, path.join(relative, entry), outList);
    } else {
      fs.copyFileSync(s, d);
      if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
    }
  }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
  const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
  if (!zipUrl) {
    throw new Error('No ZIP URL configured. Set settings.updateZipUrl or UPDATE_ZIP_URL env.');
  }
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, 'update.zip');
  await downloadFile(zipUrl, zipPath);
  const extractTo = path.join(tmpDir, 'update_extract');
  if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
  await extractZip(zipPath, extractTo);

  const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
  const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;
  const ignore = ['node_modules', '.git', 'session', 'tmp', 'tmp/', 'temp', 'data', 'baileys_store.db', '.env'];
  const copied = [];

  // Preserve .env
  let preservedEnv = null;
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try { preservedEnv = fs.readFileSync(envPath, 'utf8'); } catch {}
  }

  copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

  if (preservedEnv) {
    try { fs.writeFileSync(envPath, preservedEnv); } catch {}
  }

  try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch { }
  try { fs.rmSync(zipPath, { force: true }); } catch { }
  return { copiedFiles: copied };
}

// 🟢 HOT RELOAD: Reloads all plugins and settings in-memory without killing the process
function performHotReload() {
  let reloadedCount = 0;
  try {
    Object.keys(require.cache).forEach(id => {
      if (id.includes('/plugins/') || id.includes('\\plugins\\') || id.includes('settings.js') || id.includes('lib/messageHandler')) {
        delete require.cache[id];
        reloadedCount++;
      }
    });

    // Re-require settings
    try {
      require('../settings');
    } catch {}

    // Run garbage collection if enabled
    if (global.gc) {
      try { global.gc(); } catch {}
    }

    console.log(`[HOT-RELOAD] ✅ Refreshed ${reloadedCount} modules in-memory without restart!`);
  } catch (err) {
    console.error('[HOT-RELOAD] Error during in-memory reload:', err.message);
  }
  return reloadedCount;
}

module.exports = {
  command: 'update',
  aliases: ['upgrade', 'hotreload', 'reload'],
  category: 'owner',
  description: 'Update bot files and hot-reload plugins without disconnecting',
  usage: '.update [--cold|zip_url]',
  ownerOnly: true,

  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const isColdRequested = args.includes('--cold') || args.includes('-c') || args.includes('cold') || args.includes('restart');

    try {
      const isHeroku = await isHerokuEnv();
      const deploymentType = isHeroku ? 'Heroku' : 'Git';
      
      const statusMsg = await sock.sendMessage(chatId, {
        text: `🔄 *Checking for updates on ${deploymentType}…*`,
        ...channelInfo
      }, { quoted: message });

      let changesSummary = '';
      let hasUpdates = false;

      let gitAvailable = false;
      try {
        gitAvailable = await hasGitRepo();
      } catch (e) {
        console.error('Git check failed:', e);
      }

      if (gitAvailable) {
        try {
          const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();

          if (alreadyUpToDate) {
            hasUpdates = false;
            changesSummary = `✅ *Bot is already up to date!*\n📌 *Commit:* \`${newRev.substring(0, 7)}\`\n\n_No new updates available from remote._`;
          } else {
            hasUpdates = true;
            changesSummary = `✅ *Updated Successfully!*\n\n`;
            changesSummary += `📌 *Old:* \`${oldRev.substring(0, 7)}\`\n`;
            changesSummary += `📌 *New:* \`${newRev.substring(0, 7)}\`\n\n`;

            if (commits && commits.trim()) {
              const commitLines = commits.split('\n').filter(l => l.trim()).slice(0, 5);
              if (commitLines.length > 0) {
                changesSummary += `📝 *Recent Commits:*\n${commitLines.map(c => `• ${c}`).join('\n')}\n\n`;
              }
            }

            if (files && files.trim()) {
              const fileLines = files.split('\n').filter(l => l.trim()).slice(0, 8);
              if (fileLines.length > 0) {
                changesSummary += `📁 *Updated Files:*\n${fileLines.map(f => `• ${f}`).join('\n')}`;
              }
            }
          }
        } catch (gitError) {
          console.error('Git update failed, falling back to ZIP:', gitError.message);
          const zipOverride = args.find(a => a.startsWith('http')) || null;
          const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);

          changesSummary = `✅ *Updated from ZIP Archive!*\n\n📁 *Files updated:* ${copiedFiles.length}\n\n`;
          hasUpdates = copiedFiles.length > 0;
        }
      } else {
        const zipOverride = args.find(a => a.startsWith('http')) || null;
        const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);

        changesSummary = `✅ *Updated from ZIP Archive!*\n\n📁 *Files updated:* ${copiedFiles.length}\n\n`;
        hasUpdates = copiedFiles.length > 0;
      }

      // Perform in-memory Hot Reload (Zero Downtime)
      const reloadedCount = performHotReload();
      changesSummary += `\n\n⚡ *Hot Reload Active:* Refreshed in-memory without disconnecting!`;

      // Get latest version
      try {
        delete require.cache[require.resolve('../settings')];
        const newSettings = require('../settings');
        const v = newSettings.version || '5.2.0';
        changesSummary += `\n🔖 *Version:* ${v}`;
      } catch {}

      await sock.sendMessage(chatId, {
        text: changesSummary,
        ...channelInfo
      }, { quoted: message });

      // Only perform cold process exit if explicitly requested
      if (isColdRequested && hasUpdates) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        process.exit(0);
      }

    } catch (err) {
      console.error('Update failed:', err);
      await sock.sendMessage(chatId, {
        text: `❌ *Update failed:*\n${String(err.message || err)}`,
        ...channelInfo
      }, { quoted: message });
    }
  },

  performHotReload
};
