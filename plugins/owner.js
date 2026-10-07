const settings = require('../settings');

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'owner',
  aliases: ['creator', 'developer', 'dev', 'author'],
  category: 'info',
  description: 'Get developer & owner information with interactive links',
  usage: '.owner',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    try {
      const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
      const botOwner = settings.botOwner || 'pgwiz';
      const version = settings.version || '5.2.0';
      const channelLink = settings.channelLink || 'https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K';
      const ownerNum = (Array.isArray(settings.ownerNumber) && settings.ownerNumber[0]) || '254789462334';

      const ownerText = `*✩ ${botName} OWNER ✩*
${DIVIDER}
👑 *Owner:* ${botOwner}
🤖 *Bot:* ${botName}
🤖 *Version:* ${version}
${DIVIDER}
🌐 *Platform:* https://pgwiz.cloud
🐙 *GitHub:* https://github.com/pgwiz
📢 *Channel:* ${channelLink}
${DIVIDER}`;

      const buttons = [
        {
          type: 'url',
          text: '💬 Chat Owner',
          url: `https://wa.me/${ownerNum}`
        },
        {
          type: 'url',
          text: '📢 Official Channel',
          url: channelLink
        },
        {
          type: 'url',
          text: '🌐 Website',
          url: 'https://pgwiz.cloud'
        },
        {
          type: 'url',
          text: '🐙 GitHub',
          url: 'https://github.com/pgwiz'
        }
      ];

      try {
        if (typeof sock.sendButtons === 'function') {
          return await sock.sendButtons(chatId, {
            title: `*✩ ${botName} OWNER ✩*`,
            text: ownerText,
            footer: botName,
            buttons,
            ...channelInfo
          }, message);
        }
        return await sock.sendMessage(chatId, {
          text: ownerText,
          buttons,
          footer: botName,
          ...channelInfo
        }, { quoted: message });
      } catch {
        return await sock.sendMessage(chatId, {
          text: ownerText,
          ...channelInfo
        }, { quoted: message });
      }

    } catch (error) {
      console.error('Owner Command Error:', error);
      const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
      await sock.sendMessage(chatId, {
        text: `*✩ ${botName} OWNER ✩*\n${DIVIDER}\n👑 *Owner:* ${settings.botOwner || 'pgwiz'}\n${DIVIDER}`
      }, { quoted: message });
    }
  }
};
