// Lazy-loaded: const simpleGit = require('simple-git');
const settings = require('../settings');

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'gitinfo',
  aliases: ['infogit'],
  category: 'owner',
  description: 'Show detailed git repository information',
  usage: '.gitinfo',
  ownerOnly: true,

  async handler(sock, message) {
    const simpleGit = require('simple-git');
    const chatId = message.key.remoteJid;
    const git = simpleGit();
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return sock.sendMessage(chatId, { text: '❌ This project is not a git repository.' });
      }

      const status = await git.status();
      const branch = status.current || 'unknown';
      const dirty = status.files.length > 0;

      const commitHash = (await git.revparse(['--short', 'HEAD'])).trim();

      const ahead = status.ahead;
      const behind = status.behind;

      const modifiedCount = status.files.length;
      
      const remotes = await git.getRemotes(true);
      const remoteText = remotes.length
        ? remotes.map(r => `• ${r.name}: ${r.refs.fetch}`).join('\n')
        : 'None';

      const treeStatus = dirty ? 'Dirty (Uncommitted Changes)' : 'Clean';

      const text = `*✩ ${botName} GIT INFO ✩*
${DIVIDER}
🌿 *Branch:* ${branch}
🔖 *Commit:* ${commitHash}
🧼 *Tree:* ${treeStatus}
📊 *Ahead:* ${ahead} | *Behind:* ${behind}
📁 *Modified:* ${modifiedCount} files
${DIVIDER}
🔗 *Remotes:*
${remoteText}
${DIVIDER}`;

      await sock.sendMessage(chatId, { text });

    } catch (err) {
      await sock.sendMessage(chatId, { text: `❌ Git error: ${err.message}` });
    }
  }
};
