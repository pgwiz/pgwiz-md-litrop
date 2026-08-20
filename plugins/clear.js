const store = require('../lib/lightweight_store');

module.exports = {
    command: 'clear',
    aliases: ['clearchat', 'clr', 'clean', 'deletechat'],
    category: 'owner',
    description: 'Clear messages from the current chat or group',
    usage: '.clear',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        try {
            const isGroup = chatId.endsWith('@g.us');
            const targetName = isGroup ? 'Group' : 'Chat';

            const statusMsg = await sock.sendMessage(chatId, {
                text: "🧹 *Clearing " + targetName + "...*",
                ...channelInfo
            }, { quoted: message });

            // 1. Baileys clear command
            try {
                await sock.chatModify({
                    clear: {
                        messages: [{
                            id: message.key?.id || '',
                            fromMe: message.key?.fromMe || false,
                            timestamp: message.messageTimestamp || Math.floor(Date.now() / 1000)
                        }]
                    }
                }, chatId);
            } catch (err) {
                // Fallback delete
                await sock.chatModify({ delete: true, lastMessages: [] }, chatId).catch(() => {});
            }

            // 2. Clean local store messages
            if (store && typeof store.deleteChat === 'function') {
                await store.deleteChat(chatId).catch(() => {});
            }

            // 3. Delete the temporary status message after 3 seconds
            if (statusMsg && statusMsg.key) {
                setTimeout(async () => {
                    await sock.sendMessage(chatId, { delete: statusMsg.key }).catch(() => {});
                }, 3000);
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