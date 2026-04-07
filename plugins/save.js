const store = require('../lib/lightweight_store');

const MAX_SAVED = 50;

async function loadSaved(userId) {
  const saved = await store.getSetting(userId, 'savedMessages');
  return Array.isArray(saved) ? saved : [];
}

async function persistSaved(userId, saved) {
  await store.saveSetting(userId, 'savedMessages', saved);
}

module.exports = {
  command: 'save',
  aliases: ['saved'],
  category: 'general',
  description: 'Save a text snippet for later',
  usage: '.save <text> | reply + .save | .save list | .save del <id>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const action = (args[0] || '').toLowerCase();

    const saved = await loadSaved(senderId);

    if (action === 'list' || action === 'all') {
      if (saved.length === 0) {
        return await sock.sendMessage(chatId, { text: '🗒️ No saved items yet.' }, { quoted: message });
      }
      const lines = saved.map(item => `*${item.id}.* ${item.text}`);
      return await sock.sendMessage(chatId, { text: `🗂️ *Saved Items*\n\n${lines.join('\n')}` }, { quoted: message });
    }

    if (action === 'del' || action === 'delete' || action === 'remove') {
      const id = parseInt(args[1], 10);
      if (!id || !saved.some(item => item.id === id)) {
        return await sock.sendMessage(chatId, { text: '❌ Invalid ID. Use `.save list` to see saved items.' }, { quoted: message });
      }
      const updated = saved.filter(item => item.id !== id).map((item, index) => ({
        ...item,
        id: index + 1
      }));
      await persistSaved(senderId, updated);
      return await sock.sendMessage(chatId, { text: `✅ Removed saved item ${id}.` }, { quoted: message });
    }

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
      quoted?.conversation ||
      quoted?.extendedTextMessage?.text ||
      quoted?.imageMessage?.caption ||
      quoted?.videoMessage?.caption ||
      quoted?.documentMessage?.caption ||
      '';

    const text = quotedText || args.join(' ');
    if (!text) {
      return await sock.sendMessage(chatId, {
        text: '❌ Provide text to save or reply to a message.\n\nExample:\n• `.save remember this`\n• Reply to a message and type `.save`'
      }, { quoted: message });
    }

    const nextId = saved.length + 1;
    const entry = {
      id: nextId,
      text: text.trim().slice(0, 500),
      savedAt: new Date().toISOString()
    };

    const updated = [...saved, entry].slice(-MAX_SAVED).map((item, index) => ({
      ...item,
      id: index + 1
    }));
    await persistSaved(senderId, updated);

    await sock.sendMessage(chatId, {
      text: `✅ Saved item ${entry.id}.\n\nUse \`.save list\` to view saved items.`
    }, { quoted: message });
  }
};
