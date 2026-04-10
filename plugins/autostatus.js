const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

// Get random emoji from STATUS_EMOJIS env variable (comma-separated) or default to blue heart + black heart + star.
function getRandomStatusEmoji() {
    const emojis = (process.env.STATUS_EMOJIS || '💙,🖤,⭐').split(',').map(e => e.trim()).filter(Boolean);
    return emojis[Math.floor(Math.random() * emojis.length)];
}

function getEnvBoolean(key, defaultValue) {
    if (process.env[key] === undefined) return defaultValue;
    return String(process.env[key]).toLowerCase() === 'true';
}

function getStartupAutoStatusPolicy() {
    return {
        enabled: getEnvBoolean('AUTO_STATUS_VIEW', true),
        reactOn: getEnvBoolean('AUTO_STATUS_REACT', true)
    };
}


const configPath = path.join(__dirname, '../data/autoStatus.json');

if (!HAS_DB && !fs.existsSync(configPath)) {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({
        enabled: true,
        reactOn: true
    }, null, 2));
}

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || '120363179639202475@newsletter',
            newsletterName: settings.newsletterName || 'PGWIZ-MD',
            serverMessageId: -1
        }
    }
};

async function readConfig() {
    try {
        if (HAS_DB) {
            const config = await store.getSetting('global', 'autoStatus');

            // If no config exists, check environment variables for initial setup
            if (!config) {
                const envEnabled = getEnvBoolean('AUTO_STATUS_VIEW', true);
                const envReactOn = getEnvBoolean('AUTO_STATUS_REACT', true);

                const initialConfig = { enabled: envEnabled, reactOn: envReactOn };
                await store.saveSetting('global', 'autoStatus', initialConfig);
                console.log('[AUTOSTATUS] Initialized from environment variables:', initialConfig);
                return initialConfig;
            }

            return {
                enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
                reactOn: typeof config.reactOn === 'boolean' ? config.reactOn : true
            };
        } else {
            // File system mode
            if (!fs.existsSync(configPath)) {
                // Check environment variables for initial setup
                const envEnabled = getEnvBoolean('AUTO_STATUS_VIEW', true);
                const envReactOn = getEnvBoolean('AUTO_STATUS_REACT', true);

                const initialConfig = { enabled: envEnabled, reactOn: envReactOn };
                fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

                console.log('[AUTOSTATUS] Initialized from environment variables:', initialConfig);

                return initialConfig;
            }

            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return {
                enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
                reactOn: typeof config.reactOn === 'boolean' ? config.reactOn : true
            };
        }
    } catch (error) {
        console.error('Error reading auto status config:', error);
        return { enabled: true, reactOn: true };
    }
}

// Helper function to update .env file (improved version)
function updateEnvFile(key, value) {
    try {
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) return;

        let content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        let found = false;

        // Update existing key or add if not found
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip comments and empty lines
            if (line.startsWith('#') || !line) continue;

            // Check if this line contains our key
            if (line.startsWith(`${key}=`)) {
                // Preserve quotes if value contains special characters
                const quotedValue = (value.includes(' ') || value.includes(',') || value.includes('#'))
                    ? `"${value}"`
                    : value;
                lines[i] = `${key}=${quotedValue}`;
                found = true;
                break;
            }
        }

        // If key not found, add it before the last line
        if (!found) {
            const quotedValue = (value.includes(' ') || value.includes(',') || value.includes('#'))
                ? `"${value}"`
                : value;
            lines.push(`${key}=${quotedValue}`);
        }

        fs.writeFileSync(envPath, lines.join('\n'));
        console.log(`[ENV] Updated ${key}="${value}"`);
    } catch (error) {
        console.error('[ENV] Error updating .env file:', error.message);
    }
}

async function writeConfig(config) {
    try {
        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', config);
        } else {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        // Sync to .env file
        updateEnvFile('AUTO_STATUS_VIEW', config.enabled ? 'true' : 'false');
        updateEnvFile('AUTO_STATUS_REACT', config.reactOn ? 'true' : 'false');
    } catch (error) {
        console.error('Error writing auto status config:', error);
    }
}

async function applyStartupAutoStatusPolicy() {
    try {
        const policy = getStartupAutoStatusPolicy();

        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', policy);
        } else {
            if (!fs.existsSync(path.dirname(configPath))) {
                fs.mkdirSync(path.dirname(configPath), { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(policy, null, 2));
        }

        console.log('[AUTOSTATUS] Startup policy enforced from env:', policy);
        return policy;
    } catch (error) {
        console.error('[AUTOSTATUS] Failed to apply startup policy:', error.message);
        return getStartupAutoStatusPolicy();
    }
}

async function isAutoStatusEnabled() {
    const config = await readConfig();
    return config.enabled;
}

async function isStatusReactionEnabled() {
    const config = await readConfig();
    return config.reactOn;
}

async function reactToStatus(sock, statusKey) {
    try {
        const enabled = await isStatusReactionEnabled();
        if (!enabled) {
            return;
        }

        const emoji = getRandomStatusEmoji();

        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: emoji
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );

        console.log('[AUTOSTATUS] ✅ Reacted to status with', emoji);
    } catch (error) {
        console.error('[AUTOSTATUS] ❌ Error reacting to status:', error.message);
        console.error('[AUTOSTATUS DEBUG] Full error:', error);
    }
}

// Track reacted statuses to prevent duplicates/loops
const reactedStatuses = new Set();

// Clear cache every hour to prevent memory leaks
setInterval(() => reactedStatuses.clear(), 60 * 60 * 1000);

async function handleStatusUpdate(sock, status) {
    try {
        const enabled = await isAutoStatusEnabled();
        if (!enabled) return;

        // Handle Messages (New Statuses)
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                // Deduplicate: Don't react if already reacted
                if (reactedStatuses.has(msg.key.id)) return;

                reactedStatuses.add(msg.key.id);
                await sock.readMessages([msg.key]).catch(() => { });
                reactToStatus(sock, msg.key).catch(() => { });
                return;
            }
        }

        // Handle Status Key Updates (Less common, but possible)
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            if (reactedStatuses.has(status.key.id)) return;

            reactedStatuses.add(status.key.id);
            await sock.readMessages([status.key]).catch(() => { });
            reactToStatus(sock, status.key).catch(() => { });
            return;
        }

        // REMOVED: status.reaction handling
        // Reacting to a reaction causes infinite loops and is unnecessary.

    } catch (error) {
        // Silent fail for speed
    }
}

module.exports = {
    command: 'autostatus',
    aliases: ['autoview', 'statusview'],
    category: 'owner',
    description: 'Automatically view and react to WhatsApp statuses',
    usage: '.autostatus <on|off|react on|react off>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            let config = await readConfig();
            const policy = getStartupAutoStatusPolicy();

            if (!args || args.length === 0) {
                const viewStatus = config.enabled ? '✅ Enabled' : '❌ Disabled';
                const reactStatus = config.reactOn ? '✅ Enabled' : '❌ Disabled';

                await sock.sendMessage(chatId, {
                    text: `🔄 *Auto Status Settings*\n\n` +
                        `📱 *Auto Status View:* ${viewStatus}\n` +
                        `💫 *Status Reactions:* ${reactStatus}\n` +
                        `🔒 *Startup Policy (ENV):* View=${policy.enabled ? 'true' : 'false'}, React=${policy.reactOn ? 'true' : 'false'}\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                        `*Note:* This setting is enforced on every startup from .env variables.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, {
                text: '🔒 *Auto status is locked by startup policy.*\n\n' +
                    `AUTO_STATUS_VIEW=${policy.enabled ? 'true' : 'false'}\n` +
                    `AUTO_STATUS_REACT=${policy.reactOn ? 'true' : 'false'}\n\n` +
                    'To change behavior, update .env and restart the bot.',
                ...channelInfo
            }, { quoted: message });
            return;

        } catch (error) {
            console.error('Error in autostatus command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error occurred while managing auto status!*\n\n' +
                    `Error: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    },

    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    reactToStatus,
    readConfig,
    writeConfig,
    applyStartupAutoStatusPolicy
};
