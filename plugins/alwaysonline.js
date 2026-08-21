const store = require('../lib/lightweight_store');
const settings = require('../settings');

function parseEnvBoolean(value, fallback = true) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const s = String(value).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

async function isAlwaysOnlineEnabled() {
    if (typeof global.alwaysOnlineState === 'boolean') {
        return global.alwaysOnlineState;
    }
    try {
        const config = await store.getSetting('global', 'presenceConfig');
        if (config && typeof config.alwaysOnline === 'boolean') {
            global.alwaysOnlineState = config.alwaysOnline;
            return config.alwaysOnline;
        }
    } catch {}
    const envVal = process.env.ALWAYS_ONLINE || process.env.ALWAYS_ONLINE_PRESENCE;
    const isEn = (envVal !== undefined) ? parseEnvBoolean(envVal, true) : (settings.alwaysOnline ?? true);
    global.alwaysOnlineState = isEn;
    return isEn;
}

module.exports = {
    command: 'alwaysonline',
    aliases: ['alwayson', 'autoonline', 'online', 'presence'],
    category: 'owner',
    description: 'Keep bot continuous online presence 24/7 (on/off)',
    usage: '.alwaysonline <on|off>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const action = args[0] ? args[0].toLowerCase().trim() : '';

        try {
            const isCurrentOnline = await isAlwaysOnlineEnabled();
            const ghostMode = await store.getSetting('global', 'stealthMode');
            const ghostActive = !!(ghostMode && ghostMode.enabled);

            if (!action || action === 'status') {
                const statusText = '*🟢 ALWAYS ONLINE STATUS*\n\n' +
                    '*Status:* ' + (isCurrentOnline ? '✅ Enabled (Online 24/7)' : '❌ Disabled') + '\n' +
                    '*Stealth Mode:* ' + (ghostActive ? '👻 Active (blocks presence)' : '❌ Inactive') + '\n\n' +
                    '*Usage:*\n' +
                    '• .alwaysonline on - Keep bot online 24/7\n' +
                    '• .alwaysonline off - Turn off continuous presence';
                return await sock.sendMessage(chatId, { text: statusText, ...channelInfo }, { quoted: message });
            }

            if (action === 'on' || action === 'enable' || action === 'true' || action === '1') {
                global.alwaysOnlineState = true;
                await store.saveSetting('global', 'presenceConfig', { alwaysOnline: true });

                if (!ghostActive) {
                    await sock.sendPresenceUpdate('available').catch(() => {});
                    if (chatId) await sock.sendPresenceUpdate('available', chatId).catch(() => {});
                }

                return await sock.sendMessage(chatId, {
                    text: '✅ *Always-Online is now ACTIVE!*\n\nYour WhatsApp account will continuously broadcast online presence 24/7.',
                    ...channelInfo
                }, { quoted: message });
            }

            if (action === 'off' || action === 'disable' || action === 'false' || action === '0') {
                global.alwaysOnlineState = false;
                await store.saveSetting('global', 'presenceConfig', { alwaysOnline: false });

                if (!ghostActive) {
                    await sock.sendPresenceUpdate('unavailable').catch(() => {});
                }

                return await sock.sendMessage(chatId, {
                    text: '❌ *Always-Online has been DISABLED.*',
                    ...channelInfo
                }, { quoted: message });
            }

            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid option!* Use: .alwaysonline on or .alwaysonline off',
                ...channelInfo
            }, { quoted: message });

        } catch (error) {
            console.error('Error in alwaysonline command:', error);
            await sock.sendMessage(chatId, { text: '❌ Error toggling always-online.' }, { quoted: message });
        }
    },

    isAlwaysOnlineEnabled
};
