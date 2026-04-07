const settings = require('../settings');
const store = require('../lib/lightweight_store');

function normalizeNewsletterJid(input) {
  if (!input) return null;
  const trimmed = input.trim();

  if (trimmed.includes('whatsapp.com/channel/')) {
    return null;
  }

  if (trimmed.includes('@newsletter')) {
    return trimmed;
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `${digits}@newsletter`;
}

async function getCurrentChannel() {
  const stored = await store.getSetting('global', 'menuChannel');
  return {
    newsletterJid: stored?.newsletterJid || settings.newsletterJid || '120363179639202475@newsletter',
    newsletterName: stored?.newsletterName || settings.newsletterName || 'PGWIZ-MD',
    isCustom: !!stored?.newsletterJid
  };
}

module.exports = {
  command: 'pgwavs',
  aliases: ['menuchannel', 'setchannel'],
  category: 'owner',
  description: 'Set the WhatsApp Channel that appears on the menu',
  usage: '.pgwavs set <channel_jid> [channel_name]',
  ownerOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'help') {
      const current = await getCurrentChannel();
      return await sock.sendMessage(chatId, {
        text:
          `📢 *Menu Channel Settings*\n\n` +
          `• Current JID: ${current.newsletterJid}\n` +
          `• Name: ${current.newsletterName}\n` +
          `• Source: ${current.isCustom ? 'Custom' : 'Default'}\n\n` +
          `*How to get Channel ID:*\n` +
          `1) Copy your channel link\n` +
          `2) Run: \`.channelid <link>\`\n\n` +
          `*Usage:*\n` +
          `• \`.pgwavs set <channel_jid> [channel_name]\`\n` +
          `• \`.pgwavs show\`\n` +
          `• \`.pgwavs reset\``
      }, { quoted: message });
    }

    if (sub === 'show' || sub === 'status') {
      const current = await getCurrentChannel();
      return await sock.sendMessage(chatId, {
        text:
          `📢 *Menu Channel*\n\n` +
          `• JID: ${current.newsletterJid}\n` +
          `• Name: ${current.newsletterName}\n` +
          `• Source: ${current.isCustom ? 'Custom' : 'Default'}`
      }, { quoted: message });
    }

    if (sub === 'reset') {
      await store.saveSetting('global', 'menuChannel', null);
      return await sock.sendMessage(chatId, {
        text: '✅ Menu channel reset to default settings.'
      }, { quoted: message });
    }

    const jidInput = sub === 'set' ? args[1] : args[0];
    const nameInput = sub === 'set' ? args.slice(2).join(' ') : args.slice(1).join(' ');

    if (!jidInput) {
      return await sock.sendMessage(chatId, {
        text: '❌ Provide a channel JID.\nExample: `.pgwavs set 120363000000000@newsletter My Channel`'
      }, { quoted: message });
    }

    const newsletterJid = normalizeNewsletterJid(jidInput);
    if (!newsletterJid) {
      return await sock.sendMessage(chatId, {
        text:
          '❌ Invalid channel ID.\n\n' +
          'Get the ID using:\n' +
          '• `.channelid <your_channel_link>`\n\n' +
          'Then set it with:\n' +
          '• `.pgwavs set <channel_jid> [channel_name]`'
      }, { quoted: message });
    }

    const newsletterName = nameInput?.trim() || settings.newsletterName || 'PGWIZ-MD';
    await store.saveSetting('global', 'menuChannel', { newsletterJid, newsletterName });

    await sock.sendMessage(chatId, {
      text:
        `✅ Menu channel updated.\n\n` +
        `• JID: ${newsletterJid}\n` +
        `• Name: ${newsletterName}`
    }, { quoted: message });
  }
};
