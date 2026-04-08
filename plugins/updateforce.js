const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
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
  if (!fs.existsSync(gitDir)) return false;
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

async function forceUpdateViaGit() {
  // Force update - reset everything to remote
  await run('git remote set-url origin https://github.com/pgwiz/pgwiz-md-litrop.git').catch(() => { });
  const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
  await run('git fetch --all --prune');
  const newRev = (await run('git rev-parse origin/main')).trim();
  
  // Force reset regardless of changes
  await run(`git reset --hard ${newRev}`);
  await run('git clean -fd -e session -e .env -e store.json -e session/');

  // Get commit info for display
  const commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
  const files = await run(`git diff --name-status ${oldRev}..${newRev}`).catch(() => '');

  return { oldRev, newRev, commits, files };
}

async function restartProcess() {
  const isHeroku = await isHerokuEnv();
  if (isHeroku) {
    try {
      await run('heroku restart -a ' + (process.env.HEROKU_APP_NAME || 'app'));
      return;
    } catch { }
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    return;
  }

  try {
    await run('pm2 restart all');
    return;
  } catch { }
  
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

module.exports = {
  command: 'updateforce',
  aliases: ['forcupdate', 'forceupgrade'],
  category: 'owner',
  description: 'Force update bot (even if no changes detected)',
  usage: '.updateforce',
  ownerOnly: true,

  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;

    try {
      const isHeroku = await isHerokuEnv();
      const deploymentType = isHeroku ? 'Heroku' : 'Git';
      
      await sock.sendMessage(chatId, {
        text: `🔄 Force updating bot on ${deploymentType}…`,
        ...channelInfo
      }, { quoted: message });

      let changesSummary = '';

      let gitAvailable = false;
      try {
        gitAvailable = await hasGitRepo();
      } catch (e) {
        console.error('Git check failed:', e);
      }

      if (gitAvailable) {
        try {
          // Force update regardless of current state
          const { oldRev, newRev, commits, files } = await forceUpdateViaGit();

          changesSummary = `✅ Force updated successfully!\n\n`;
          changesSummary += `📌 Old: ${oldRev.substring(0, 7)}\n`;
          changesSummary += `📌 New: ${newRev.substring(0, 7)}\n\n`;

          // Show last 5 commits
          if (commits && commits.trim()) {
            const commitLines = commits.split('\n').filter(l => l.trim()).slice(0, 5);
            if (commitLines.length > 0) {
              changesSummary += `📝 Recent commits:\n${commitLines.map(c => `• ${c}`).join('\n')}\n\n`;
            }
          }

          // Show changed files (max 10)
          if (files && files.trim()) {
            const fileLines = files.split('\n').filter(l => l.trim()).slice(0, 10);
            if (fileLines.length > 0) {
              changesSummary += `📁 Changed files:\n${fileLines.map(f => `• ${f}`).join('\n')}`;
              const totalFiles = files.split('\n').filter(l => l.trim()).length;
              if (totalFiles > 10) {
                changesSummary += `\n... and ${totalFiles - 10} more`;
              }
            } else {
              changesSummary += `📁 No file changes detected\n`;
            }
          } else {
            changesSummary += `📁 No file changes detected\n`;
          }

          // Install dependencies after update
          await run('npm install --no-audit --no-fund');
        } catch (gitError) {
          console.error('Force update failed:', gitError);
          changesSummary = `❌ Force update failed:\n${String(gitError.message || gitError)}\n\n`;
          
          await sock.sendMessage(chatId, {
            text: changesSummary,
            ...channelInfo
          }, { quoted: message });
          return;
        }
      } else {
        changesSummary = `❌ Git repository not available on this platform. Force update requires git.\n`;
        
        await sock.sendMessage(chatId, {
          text: changesSummary,
          ...channelInfo
        }, { quoted: message });
        return;
      }

      try {
        delete require.cache[require.resolve('../settings')];
        const newSettings = require('../settings');
        const v = newSettings.version || 'unknown';
        changesSummary += `\n\n🔖 Version: ${v}`;
      } catch { }

      const restartMsg = isHeroku ? '♻️ Restarting dyno...' : '♻️ Restarting bot...';
      await sock.sendMessage(chatId, {
        text: changesSummary + '\n\n' + restartMsg,
        ...channelInfo
      }, { quoted: message });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await restartProcess();

    } catch (err) {
      console.error('Force update failed:', err);
      await sock.sendMessage(chatId, {
        text: `❌ Force update failed:\n${String(err.message || err)}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
