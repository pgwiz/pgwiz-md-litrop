module.exports = {
  command: 'jid',
  aliases: ['userid', 'id', 'getjid', 'gid', 'groupid'],
  category: 'info',
  description: 'Get JID (WhatsApp ID) of a user, group, or channel',
  usage: '.jid [@user|reply|number] | .gid',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const invoked = (context.invokedCmd || context.command || '').toLowerCase();

    // 1. Group ID shortcut (.gid / .groupid)
    if (invoked === 'gid' || invoked === 'groupid') {
      if (!isGroup) {
        return await sock.sendMessage(chatId, {
          text: '❌ This command can only be used within a group chat.'
        }, { quoted: message });
      }

      let groupName = '';
      try {
        const metadata = await sock.groupMetadata(chatId);
        groupName = metadata.subject || '';
      } catch (e) {}

      return await sock.sendMessage(chatId, {
        text: `🆔 *Group ID:* \`${chatId}\`${groupName ? `\n🏷️ *Name:* ${groupName}` : ''}`
      }, { quoted: message });
    }

    // 2. User/Target JID lookup
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    let target = ctx?.mentionedJid?.[0] || ctx?.participant;

    // Try parsing phone number from argument
    if (!target && args?.[0]) {
      const input = args[0].replace(/[^0-9]/g, '');
      if (input.length >= 7) {
        target = `${input}@s.whatsapp.net`;
      }
    }

    // Default to message sender if no target found
    if (!target) {
      target = message.key.participant || message.key.remoteJid;
    }

    // Resolve LID to actual JID in groups
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

    // Extract clean ID and determine type
    const cleanId = resolved.split('@')[0].split(':')[0];
    let idType = 'USER';
    let idDetails = '';

    if (resolved.includes('@g.us')) {
      idType = 'GROUP';
      idDetails = '(Group JID)';
    } else if (resolved.includes('@s.whatsapp.net')) {
      idType = 'USER (Phone)';
      idDetails = `(Regular user, ${cleanId})`;
    } else if (resolved.includes('@lid')) {
      idType = 'USER (LID)';
      idDetails = '(Linked ID - internal WhatsApp ID)';
    } else if (resolved.includes(':')) {
      idType = 'BROADCAST';
      idDetails = '(Broadcast/Newsletter)';
    } else if (resolved.includes('@newsletter')) {
      idType = 'NEWSLETTER';
      idDetails = '(WhatsApp Newsletter)';
    }

    const text = `
═══════════════════════════════════
🆔 JID LOOKUP & ID TYPE
═══════════════════════════════════

📱 *Full JID:* \`${resolved}\`
👤 *Clean ID:* ${cleanId}
🏷️ *Type:* ${idType}
ℹ️ *Details:* ${idDetails}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *ID Format Guide:*
• \`xxx@s.whatsapp.net\` = Regular User
• \`xxx@g.us\` = Group
• \`xxx@lid\` = Linked ID (Groups)
• \`xxx@newsletter\` = Newsletter
• \`xxx:yy@g.us\` = Broadcast

⏰ Retrieved: ${new Date().toLocaleTimeString()}`.trim();

    await sock.sendMessage(chatId, {
      text: text
    }, { quoted: message });
  }
};
