module.exports = {
  command: 'gid',
  aliases: ['groupid'],
  category: 'group',
  description: 'Show the current group ID',
  usage: '.gid',
  groupOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    let groupName = '';
    try {
      const metadata = await sock.groupMetadata(chatId);
      groupName = metadata.subject || '';
    } catch (e) {}

    await sock.sendMessage(chatId, {
      text: `🆔 *Group ID:* ${chatId}${groupName ? `\n🏷️ *Name:* ${groupName}` : ''}`
    }, { quoted: message });
  }
};
