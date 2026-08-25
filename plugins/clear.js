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
        const isGroup = chatId.endsWith('@g.us');
        const targetName = isGroup ? 'Group' : 'Chat';

        try {
            const statusMsg = await sock.sendMessage(chatId, {
                text: `🧹 *Clearing ${targetName}...*`,
                ...channelInfo
            }, { quoted: message });

            const nowTs = Math.floor(Date.now() / 1000);
            const dummyMsg = {
                key: {
                    id: message.key?.id || '0',
                    remoteJid: chatId,
                    fromMe: true
                },
                messageTimestamp: message.messageTimestamp || nowTs
            };

            // 1. WhatsApp Clear Chat App Patch with valid lastMessages
            try {
                await sock.chatModify({
                    clear: true,
                    lastMessages: [dummyMsg]
                }, chatId);
            } catch (err1) {
                // Fallback deleteChat patch
                await sock.chatModify({
                    delete: true,
                    lastMessages: [dummyMsg]
                }, chatId).catch(() => {});
            }

            // 2. Clean local store messages
            if (store && typeof store.deleteChat === 'function') {
                await store.deleteChat(chatId).catch(() => {});
            }

            // 3. Delete status message after 2.5s
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
