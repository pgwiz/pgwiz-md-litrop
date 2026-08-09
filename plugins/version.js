const settings = require('../settings');
const store = require('../lib/lightweight_store');

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

    const channelInfo = context.channelInfo || {
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: settings.newsletterJid || '120363179639202475@newsletter',
          newsletterName: settings.newsletterName || 'PGWIZ-MD',
          serverMessageId: -1
        }
      }
    };

    const text = `⚡ *PGWIZ-MD EDITION & VERSION*

📦 *Edition:* \`Lightweight Edition (pgwiz-md-litrop)\`
🚀 *Version:* \`v${settings.version}\`
🤖 *Bot Name:* *${settings.botName}*
🌍 *Active Mode:* \`${mode.toUpperCase()}\`
⏱️ *Uptime:* *${uptimeStr}*
🔗 *Repository:* https://github.com/pgwiz/pgwiz-md-litrop`;

    await sock.sendMessage(chatId, {
      text: text,
      ...channelInfo
    }, { quoted: message });
  }
};
