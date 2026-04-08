const settings = require('../settings');

module.exports = {
  command: 'developer',
  aliases: ['dev', 'creator', 'author'],
  category: 'general',
  description: 'Show developer and project information',
  usage: '.developer',
  isPrefixless: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    const text = `
╔════════════════════════════════════╗
║    👨‍💻 DEVELOPER INFORMATION      ║
╚════════════════════════════════════╝

🔗 *Website:* https://pgwiz.cloud
📱 *Platform:* pgwiz.cloud

🏴 *GitHub:*
   • Main Repo: https://github.com/pgwiz
   • Bot Repo: https://github.com/pgwiz/pgwiz-md-litrop

💾 *Version:* ${settings.version}
🤖 *Bot Name:* ${settings.botName}
👤 *Bot Owner:* ${settings.botOwner}

📧 *Contact:* Through GitHub issues or website

═══════════════════════════════════`;

    await sock.sendMessage(chatId, {
      text: text
    }, { quoted: message });
  }
};
