const store = require('../lib/lightweight_store');

module.exports = {
    command: 'clear',
    aliases: ['clearchat', 'clr', 'clean'],
    category: 'owner',
    description: 'Clear messages from the current chat or group (keeps the chat, deletes messages)',
    usage: '.clear',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const isGroup = chatId.endsWith('@g.us');
        const targetName = isGroup ? 'Group' : 'Chat';

        try {
            const statusMsg = await sock.sendMessage(chatId, {
                text: `🧹 *Clearing ${targetName} messages...*`,
                ...channelInfo
            }, { quoted: message });

            // 1. Fetch genuine messages from store
            let chatMessages = [];
            if (store && typeof store.loadMessages === 'function') {
                chatMessages = await store.loadMessages(chatId, 100);
            } else if (store && store.messages && store.messages[chatId]) {
                chatMessages = Array.isArray(store.messages[chatId]) 
                    ? store.messages[chatId] 
                    : Object.values(store.messages[chatId]);
            }

            // Always include current command message so at least 1 real key is present
            if (chatMessages.length === 0 && message?.key?.id) {
                chatMessages.push(message);
            }

            // 2. Perform accurate chatModify clear (wipe messages, KEEP the chat conversation)
            if (chatMessages && chatMessages.length > 0) {
                const messagesToClear = chatMessages.map(m => ({
                    id: m.key?.id || m.id,
                    fromMe: Boolean(m.key?.fromMe ?? m.fromMe),
                    timestamp: String(m.messageTimestamp || m.timestamp || Math.floor(Date.now() / 1000))
                })).filter(m => m.id);

                if (messagesToClear.length > 0) {
                    await sock.chatModify({
                        clear: { messages: messagesToClear }
                    }, chatId).catch(err => {
                        console.warn(`[CLEAR] chatModify clear notice for ${chatId}:`, err.message);
                    });
                }
            }

            // 3. Clean local store messages
            if (store && typeof store.deleteChat === 'function') {
                await store.deleteChat(chatId).catch(() => {});
            }

            // 4. Delete status confirmation message after 2.5s
            if (statusMsg && statusMsg.key) {
                setTimeout(async () => {
                    await sock.sendMessage(chatId, { delete: statusMsg.key }).catch(() => {});
                }, 2500);
            }

        } catch (error) {
            console.error('Error in clear command:', error);
            await sock.sendMessage(chatId, {
                text: "❌ *Failed to clear chat:* " + error.message,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
