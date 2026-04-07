const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

module.exports = {
  command: 'wipe',
  aliases: ['clean', 'purge'],
  category: 'admin',
  description: 'Force delete messages (bot/all/prefix)',
  usage: '.wipe [bot | all | prefix] [count]',

  async handler(sock, message, args, context = {}) {
    const chatId = message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    try {
      const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
      let isAdm = false;
      let isBotAdm = false;

      if (isGroup) {
        const adminCheck = await isAdmin(sock, chatId, senderId);
        isAdm = adminCheck.isSenderAdmin;
        isBotAdm = adminCheck.isBotAdmin;
      } else {
        isAdm = true; 
      }

      if (!isOwner && !isAdm) return;

      const type = args[0]?.toLowerCase() || 'bot';
      const count = parseInt(args[1]) || 20;

      await sock.sendMessage(chatId, { 
        text: `🧹 Fetching messages...` 
      }, { quoted: message });

      // Fetch messages directly from WhatsApp
      let messages = [];
      try {
        const history = await sock.fetchMessageHistory(count + 50, message.key, message.messageTimestamp);
        messages = history.messages || [];
      } catch (e) {
        console.log('History fetch failed, trying store');
      }

      // Fallback to store
      if (messages.length === 0 && sock.store?.messages?.[chatId]) {
        const chatStore = sock.store.messages[chatId];
        messages = chatStore.array || (chatStore.toJSON ? chatStore.toJSON() : []);
      }

      if (messages.length === 0) {
        return await sock.sendMessage(chatId, { 
          text: `❌ Could not fetch message history. Try replying to a message with \`.wipe\`` 
        }, { quoted: message });
      }

      let deletedCount = 0;
      const toDelete = messages.slice(0, count);

      for (const msg of toDelete) {
        if (!msg.key || msg.key.id === message.key.id) continue;

        let shouldDelete = false;
        const isFromMe = msg.key.fromMe;

        if (type === 'bot') {
          if (isFromMe) shouldDelete = true;
        } else if (type === 'all') {
          shouldDelete = true;
        } else if (type === 'prefix') {
          const body = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       msg.message?.imageMessage?.caption || 
                       msg.message?.videoMessage?.caption || '';
          if ((body.startsWith('.') || body.startsWith('!') || body.startsWith('/') || body.startsWith('#'))) {
             shouldDelete = true;
          }
        }

        if (shouldDelete) {
          try {
            await sock.sendMessage(chatId, { delete: msg.key });
            deletedCount++;
            await new Promise(res => setTimeout(res, 400));
          } catch (e) { 
            continue; 
          }
        }
      }

      const report = await sock.sendMessage(chatId, { 
        text: `✅ Deleted ${deletedCount} messages` 
      }, { quoted: message });
      
      setTimeout(async () => {
        try {
          await sock.sendMessage(chatId, { delete: report.key });
          await sock.sendMessage(chatId, { delete: message.key });
        } catch (e) {}
      }, 4000);

    } catch (error) {
      console.error('Wipe Error:', error);
      await sock.sendMessage(chatId, { 
        text: `❌ Error: ${error.message}` 
      }, { quoted: message });
    }
  }
};
