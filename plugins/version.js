const settings = require('../settings');
const store = require('../lib/lightweight_store');

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'version',
  aliases: ['v', 'ver', 'botversion', 'variant'],
  category: 'general',
  description: 'Display bot edition, version and system info',
  usage: '.version',
  
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const mode = await store.getBotMode();
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const channelInfo = context.channelInfo || require('../lib/messageConfig').channelInfo;
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const version = settings.version || '5.2.0';

    const text = `*✩ ${botName} VERSION ✩*
${DIVIDER}
📦 *Edition:* Lightweight Edition (pgwiz-md-litrop)
🚀 *Version:* v${version}
🤖 *Bot:* ${botName}
🌍 *Mode:* ${mode.toUpperCase()}
⏱️ *Uptime:* ${uptimeStr}
${DIVIDER}
🔗 *Repository:* https://github.com/pgwiz/pgwiz-md-litrop
${DIVIDER}`;

    await sock.sendMessage(chatId, {
      text: text,
      ...channelInfo
    }, { quoted: message });
  }
};
