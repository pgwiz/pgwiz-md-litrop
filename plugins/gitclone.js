const axios = require('axios');

module.exports = {
  command: 'gitclone',
  aliases: ['githubdl', 'clone', 'gitclone2', 'githubdl2', 'clone2'],
  category: 'download',
  description: 'Download a GitHub repository as a ZIP archive',
  usage: '.gitclone <github-url | username repo>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const input = args.join(' ').trim();

    if (!input) {
      return await sock.sendMessage(chatId, {
        text: '🌟 *GitHub Repository Downloader*\n\nUsage:\n• `.clone https://github.com/pgwiz/PGWIZ-MD`\n• `.clone pgwiz PGWIZ-MD`'
      }, { quoted: message });
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '📦', key: message.key } });

      let user = '';
      let repo = '';

      const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\s#?]+)/i;
      const match = input.match(regex);

      if (match) {
        user = match[1];
        repo = match[2].replace(/\.git$/i, '');
      } else if (args.length >= 2) {
        user = args[0].trim();
        repo = args[1].trim().replace(/\.git$/i, '');
      } else {
        return await sock.sendMessage(chatId, {
          text: '❌ Invalid GitHub URL or repository format.'
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, {
        text: `⏳ Preparing repository archive for *${user}/${repo}*...`
      }, { quoted: message });

      const zipballUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

      await sock.sendMessage(chatId, {
        document: { url: zipballUrl },
        fileName: `${repo}.zip`,
        mimetype: 'application/zip',
        caption: `📦 *${user}/${repo}*\n> Downloaded via MEGA-MD`
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
      console.error('Gitclone error:', err.message);
      await sock.sendMessage(chatId, {
        text: `❌ Failed to download repository: ${err.message}`
      }, { quoted: message });
    }
  }
};
