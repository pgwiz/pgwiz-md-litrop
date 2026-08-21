const store = require('../lib/lightweight_store');
const settings = require('../settings');

function parseEnvBoolean(value, fallback = false) {
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
    const isEn = (envVal !== undefined && String(envVal).trim() !== '') 
        ? parseEnvBoolean(envVal, false) 
        : (settings.alwaysOnline ?? false);
    global.alwaysOnlineState = isEn;
    return isEn;
}

async function sendOnlinePresence(sock) {
    if (!sock) return;
    try {
        const me = sock?.authState?.creds?.me || sock?.user;
        const name = String(me?.name || settings.botName || 'PGWIZ-MD').replace(/@/g, '');
        if (me && !me.name) me.name = name;

        await sock.sendPresenceUpdate('available').catch(() => {});
        if (typeof sock.sendNode === 'function') {
            await sock.sendNode({
                tag: 'presence',
                attrs: { name, type: 'available' }
            }).catch(() => {});
        }
    } catch {}
}

async function sendOfflinePresence(sock) {
    if (!sock) return;
    try {
        const me = sock?.authState?.creds?.me || sock?.user;
        const name = String(me?.name || settings.botName || 'PGWIZ-MD').replace(/@/g, '');

        await sock.sendPresenceUpdate('unavailable').catch(() => {});
        if (typeof sock.sendNode === 'function') {
            await sock.sendNode({
                tag: 'presence',
                attrs: { name, type: 'unavailable' }
            }).catch(() => {});
        }
    } catch {}
}

module.exports = {
    command: 'alwaysonline',
    aliases: ['alwayson', 'autoonline', 'online', 'presence'],
    category: 'owner',
    description: 'Toggle continuous online presence 24/7 (on/off)',
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
                const statusText = '*🟢 ALWAYS ONLINE SETTINGS*\n\n' +
                    '*Status:* ' + (isCurrentOnline ? '✅ Enabled (Online 24/7)' : '❌ Disabled (Standard Offline)') + '\n' +
                    '*Stealth Mode:* ' + (ghostActive ? '👻 Active' : '❌ Inactive') + '\n\n' +
                    '*Commands:*\n' +
                    '• .alwaysonline on - Stay online 24/7 continuously\n' +
                    '• .alwaysonline off - Go offline when idle (standard mode)';
                return await sock.sendMessage(chatId, { text: statusText, ...channelInfo }, { quoted: message });
            }

            if (action === 'on' || action === 'enable' || action === 'true' || action === '1') {
                global.alwaysOnlineState = true;
                await store.saveSetting('global', 'presenceConfig', { alwaysOnline: true });

                if (!ghostActive) {
                    await sendOnlinePresence(sock);
                    if (chatId) await sock.sendPresenceUpdate('available', chatId).catch(() => {});
                }

                return await sock.sendMessage(chatId, {
                    text: '✅ *Always-Online is now ENABLED!*\n\nThe bot will now broadcast online presence 24/7 continuously.',
                    ...channelInfo
                }, { quoted: message });
            }

            if (action === 'off' || action === 'disable' || action === 'false' || action === '0') {
                global.alwaysOnlineState = false;
                await store.saveSetting('global', 'presenceConfig', { alwaysOnline: false });

                if (!ghostActive) {
                    await sendOfflinePresence(sock);
                    if (chatId) await sock.sendPresenceUpdate('unavailable', chatId).catch(() => {});
                }

                return await sock.sendMessage(chatId, {
                    text: '❌ *Always-Online is now DISABLED.*\n\nThe bot will now appear offline when idle.',
                    ...channelInfo
                }, { quoted: message });
            }

            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid option!* Use: .alwaysonline on or .alwaysonline off',
                ...channelInfo
            }, { quoted: message });

        } catch (error) {
            console.error('Error in alwaysonline command:', error);
            await sock.sendMessage(chatId, { text: '❌ Error updating always-online.' }, { quoted: message });
        }
    },

    isAlwaysOnlineEnabled,
    sendOnlinePresence,
    sendOfflinePresence
};
