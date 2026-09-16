const settings = require('../settings');

module.exports = {
  command: 'owner',
  aliases: ['creator', 'developer', 'dev', 'author'],
  category: 'info',
  description: 'Get developer & owner information',
  usage: '.owner',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    try {
      const ownerText = 
`╔════════════════════════════════════╗
║    👨‍💻 DEVELOPER & OWNER INFO       ║
╚════════════════════════════════════╝

👑 *Bot Owner:* ${settings.botOwner || 'pgwiz'}
🤖 *Bot Name:* ${settings.botName || 'MEGA-MD'}
💾 *Version:* ${settings.version || '5.0.0'}

🌐 *Official Platform:* https://pgwiz.cloud
🐙 *GitHub:* https://github.com/pgwiz
📢 *WhatsApp Channel:* https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K

🚀 Visit *https://pgwiz.cloud* for tools, API services, and updates!
════════════════════════════════════`;

      await sock.sendMessage(chatId, {
        text: ownerText,
        ...channelInfo
      }, { quoted: message });
    } catch (error) {
      console.error('Owner Command Error:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to fetch owner info.'
      }, { quoted: message });
    }
  }
};
