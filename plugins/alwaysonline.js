const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = path.join(__dirname, '..', 'data', 'presenceConfig.json');

function parseEnvBoolean(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const s = String(value).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

async function getDefaultAlwaysOnlineEnabled() {
    if (store && typeof store.getEnvBackedSetting === 'function') {
        const rawValue = await store.getEnvBackedSetting('ALWAYS_ONLINE', 'false');
        return parseEnvBoolean(rawValue, false);
    }
    const rawValue = process.env.ALWAYS_ONLINE;
    return parseEnvBoolean(rawValue, false);
}

async function initPresenceConfig() {
    const defaultEnabled = await getDefaultAlwaysOnlineEnabled();

    if (HAS_DB) {
        const config = await store.getSetting('global', 'presenceConfig');
        if (!config || typeof config.alwaysOnline !== 'boolean') {
            const initial = { alwaysOnline: defaultEnabled };
            await store.saveSetting('global', 'presenceConfig', initial);
            return initial;
        }
        return { alwaysOnline: !!config.alwaysOnline };
    }

    if (!fs.existsSync(configPath)) {
        const dataDir = path.dirname(configPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify({ alwaysOnline: defaultEnabled }, null, 2));
        return { alwaysOnline: defaultEnabled };
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (typeof config.alwaysOnline !== 'boolean') {
            config.alwaysOnline = defaultEnabled;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
        return { alwaysOnline: !!config.alwaysOnline };
    } catch (e) {
        return { alwaysOnline: defaultEnabled };
    }
}

async function savePresenceConfig(config) {
    if (HAS_DB) {
        await store.saveSetting('global', 'presenceConfig', { alwaysOnline: !!config.alwaysOnline });
        return;
    }

    const dataDir = path.dirname(configPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ alwaysOnline: !!config.alwaysOnline }, null, 2));
}

async function isAlwaysOnlineEnabled() {
    try {
        const config = await initPresenceConfig();
        return !!config.alwaysOnline;
    } catch (error) {
        console.error('Error checking always-online status:', error);
        return false;
    }
}

module.exports = {
    command: 'alwaysonline',
    aliases: ['alwayson', 'presenceonline', 'autoonline', 'online'],
    category: 'owner',
    description: 'Toggle bot continuous online presence (on/off, true/false)',
    usage: '.alwaysonline <on|off|true|false>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        try {
            const config = await initPresenceConfig();
            const action = args[0]?.toLowerCase()?.trim();
            const ghostMode = await store.getSetting('global', 'stealthMode');
            const ghostActive = !!(ghostMode && ghostMode.enabled);

            if (!action || action === 'status') {
                await sock.sendMessage(chatId, {
                    text: `*🟢 ALWAYS ONLINE STATUS*\n\n` +
                          `*Current Status:* ${config.alwaysOnline ? '✅ Enabled (Online 24/7)' : '❌ Disabled'}\n` +
                          `*Stealth Mode:* ${ghostActive ? '👻 Active (overrides presence)' : '❌ Inactive'}\n` +
                          `*Storage:* ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                          `*Commands:*\n` +
                          `• \`.alwaysonline on\` / \`.alwaysonline true\` - Keep bot online\n` +
                          `• \`.alwaysonline off\` / \`.alwaysonline false\` - Disable always-online\n\n` +
                          `*Note:* When enabled, the bot sends periodic presence updates to appear online 24/7.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (action === 'on' || action === 'enable' || action === 'true' || action === '1') {
                if (config.alwaysOnline) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Always-online is already enabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                config.alwaysOnline = true;
                await savePresenceConfig(config);

                if (!ghostActive) {
                    await sock.sendPresenceUpdate('available').catch(() => {});
                }

                await sock.sendMessage(chatId, {
                    text: `✅ *Always-online enabled!*${ghostActive ? '\n\n⚠️ *Stealth mode is active* - online presence is currently blocked.' : '\nBot will now stay online 24/7.'}`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (action === 'off' || action === 'disable' || action === 'false' || action === '0') {
                if (!config.alwaysOnline) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Always-online is already disabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                config.alwaysOnline = false;
                await savePresenceConfig(config);

                if (!ghostActive) {
                    await sock.sendPresenceUpdate('unavailable').catch(() => {});
                }

                await sock.sendMessage(chatId, {
                    text: '❌ *Always-online disabled!*',
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, {
                text: '❌ *Invalid option!*\n\nUse: `.alwaysonline on` or `.alwaysonline off` (or `true` / `false`)',
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            console.error('Error in alwaysonline command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error processing command!*',
                ...channelInfo
            }, { quoted: message });
        }
    },

    initPresenceConfig,
    isAlwaysOnlineEnabled
};
