module.exports = {
  command: 'jid',
  aliases: ['userid'],
  category: 'info',
  description: 'Show the JID of a user',
  usage: '.jid @user | reply | number',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    const ctx = message.message?.extendedTextMessage?.contextInfo;
    let target = ctx?.mentionedJid?.[0] || ctx?.participant;

    if (!target && args?.[0]) {
      const input = args[0].replace(/[^0-9]/g, '');
      if (input.length >= 7) {
        target = `${input}@s.whatsapp.net`;
      }
    }

    if (!target) {
      target = message.key.participant || message.key.remoteJid;
    }

    let resolved = target;
    if (isGroup && target.endsWith('@lid')) {
      try {
        const metadata = await sock.groupMetadata(chatId);
        const participant = metadata.participants.find(p => p.lid === target || p.id === target);
        if (participant?.id) {
          resolved = participant.id;
        }
      } catch (e) {}
    }

    const cleanId = resolved.split('@')[0].split(':')[0];
    await sock.sendMessage(chatId, {
      text: `🆔 *JID:* ${resolved}\n👤 *User:* ${cleanId}`
    }, { quoted: message });
  }
};
