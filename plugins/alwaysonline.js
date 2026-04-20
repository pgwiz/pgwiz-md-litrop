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
    return String(value).toLowerCase() === 'true';
}

async function getDefaultAlwaysOnlineEnabled() {
    const rawValue = await store.getEnvBackedSetting('ALWAYS_ONLINE', 'false');
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

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (typeof config.alwaysOnline !== 'boolean') {
        config.alwaysOnline = defaultEnabled;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    return { alwaysOnline: !!config.alwaysOnline };
}

async function savePresenceConfig(config) {
    if (HAS_DB) {
        await store.saveSetting('global', 'presenceConfig', { alwaysOnline: !!config.alwaysOnline });
        return;
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
    aliases: ['alwayson', 'presenceonline'],
    category: 'owner',
    description: 'Keep bot presence online continuously',
    usage: '.alwaysonline <on|off>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        try {
            const config = await initPresenceConfig();
            const action = args[0]?.toLowerCase();
            const ghostMode = await store.getSetting('global', 'stealthMode');
            const ghostActive = !!(ghostMode && ghostMode.enabled);

            if (!action) {
                await sock.sendMessage(chatId, {
                    text: `*🟢 ALWAYS ONLINE STATUS*\n\n` +
                          `*Current Status:* ${config.alwaysOnline ? '✅ Enabled' : '❌ Disabled'}\n` +
                          `*Stealth Mode:* ${ghostActive ? '👻 Active (overrides online presence)' : '❌ Inactive'}\n` +
                          `*Storage:* ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                          `*Commands:*\n` +
                          `• \`.alwaysonline on\` - Keep bot online\n` +
                          `• \`.alwaysonline off\` - Disable always-online\n\n` +
                          `*Note:* When enabled, the bot sends periodic available presence updates.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (action === 'on' || action === 'enable') {
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
                    text: `✅ *Always-online enabled!*${ghostActive ? '\n\n⚠️ *Ghost mode is active* - online presence is currently blocked.' : ''}`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (action === 'off' || action === 'disable') {
                if (!config.alwaysOnline) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Always-online is already disabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                config.alwaysOnline = false;
                await savePresenceConfig(config);

                await sock.sendMessage(chatId, {
                    text: '❌ *Always-online disabled!*',
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, {
                text: '❌ *Invalid option!*\n\nUse: `.alwaysonline on/off`',
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
