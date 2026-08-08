const settings = require('../settings');

module.exports = {
  command: 'owner',
  aliases: ['creator', 'developer', 'dev'],
  category: 'info',
  description: 'Get developer & owner information',
  usage: '.owner',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    try {
      const ownerText = `👑 *BOT OWNER & DEVELOPER INFO*\n\n` +
                        `👤 *Owner:* ${settings.botOwner || 'Qasim Ali (PGWIZ)'}\n` +
                        `🌐 *Official Platform:* https://pgwiz.cloud\n` +
                        `📢 *WhatsApp Channel:* https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K\n\n` +
                        `🚀 Visit *https://pgwiz.cloud* to explore official tools, API services, and bot updates!`;

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
