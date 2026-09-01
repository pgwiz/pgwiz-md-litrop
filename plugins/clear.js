const store = require('../lib/lightweight_store');

module.exports = {
    command: 'clear',
    aliases: ['clearchat', 'clr', 'clean'],
    category: 'owner',
    description: 'Clear all messages in current chat or group (keeps chat thread, wipes message history)',
    usage: '.clear',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const isGroup = chatId.endsWith('@g.us');
        const targetName = isGroup ? 'Group' : 'Chat';

        try {
            const statusMsg = await sock.sendMessage(chatId, {
                text: `🧹 *Clearing whole ${targetName}...*`,
                ...channelInfo
            }, { quoted: message });

            // 1. Fetch real messages from store
            let chatMessages = [];
            if (store && typeof store.loadMessages === 'function') {
                chatMessages = await store.loadMessages(chatId, 100);
            } else if (store && store.messages && store.messages[chatId]) {
                chatMessages = Array.isArray(store.messages[chatId]) 
                    ? store.messages[chatId] 
                    : Object.values(store.messages[chatId]);
            }

            // 2. Prepare valid lastMessages list for Baileys clearChatAction
            let lastMessages = [];
            if (chatMessages && chatMessages.length > 0) {
                lastMessages = chatMessages.map(m => {
                    const id = m.key?.id || m.id;
                    const fromMe = Boolean(m.key?.fromMe ?? m.fromMe);
                    const timestamp = Number(m.messageTimestamp || m.timestamp) || Math.floor(Date.now() / 1000);
                    const participant = (isGroup && !fromMe)
                        ? (m.key?.participant || m.participant || (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : undefined))
                        : undefined;

                    return {
                        key: {
                            id,
                            remoteJid: chatId,
                            fromMe,
                            ...(participant ? { participant } : {})
                        },
                        messageTimestamp: timestamp
                    };
                }).filter(m => m.key.id);
            }

            // Always ensure at least the current command message is present
            if (lastMessages.length === 0 && message?.key?.id) {
                const isFromMe = Boolean(message.key.fromMe);
                const participant = (isGroup && !isFromMe)
                    ? (message.key.participant || (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : undefined))
                    : undefined;

                lastMessages.push({
                    key: {
                        id: message.key.id,
                        remoteJid: chatId,
                        fromMe: isFromMe,
                        ...(participant ? { participant } : {})
                    },
                    messageTimestamp: Number(message.messageTimestamp) || Math.floor(Date.now() / 1000)
                });
            }

            // 3. Perform official WhatsApp Web app-state clearChat mutation
            if (lastMessages.length > 0) {
                await sock.chatModify({
                    clear: true,
                    lastMessages: lastMessages
                }, chatId).catch(err => {
                    console.warn(`[CLEAR] chatModify clear error for ${chatId}:`, err.message);
                });
            }

            // 4. Wipe local message database / store cache
            if (store && typeof store.deleteChat === 'function') {
                await store.deleteChat(chatId).catch(() => {});
            }

            // 5. Delete confirmation status bubble after 2 seconds
            if (statusMsg && statusMsg.key) {
                setTimeout(async () => {
                    await sock.sendMessage(chatId, { delete: statusMsg.key }).catch(() => {});
                }, 2000);
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
