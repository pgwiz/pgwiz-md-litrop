
async function handleAutoDownloadStatus(sock, msg) {
    try {
        const isSaveEnabled = await store.getSetting('global', 'autoStatusSave');
        const envSave = process.env.AUTO_STATUS_SAVE || process.env.AUTO_STATUS_DOWNLOAD;
        const enabled = (isSaveEnabled !== undefined && isSaveEnabled !== null) ? Boolean(isSaveEnabled) : (String(envSave).toLowerCase() === 'true');
        if (!enabled) return;

        const ownerNum = settings.ownerNumber || (sock.user?.id ? sock.user.id.split(':')[0] : null);
        if (!ownerNum) return;
        const ownerJid = ownerNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        const sender = (msg.key?.participant || '').split('@')[0];
        const captionPrefix = `📥 *[AUTO-STATUS DOWNLOAD]*\n👤 *From:* +${sender}\n\n`;

        const m = msg.message;
        const type = Object.keys(m || {})[0];
        if (!type) return;

        if (type === 'conversation' || type === 'extendedTextMessage') {
            const text = m.conversation || m.extendedTextMessage?.text || '';
            await sock.sendMessage(ownerJid, { text: `${captionPrefix}${text}` });
        } else if (type === 'imageMessage' || type === 'videoMessage') {
            const stream = await downloadMediaMessage(msg, 'buffer', {});
            if (type === 'imageMessage') {
                await sock.sendMessage(ownerJid, { image: stream, caption: `${captionPrefix}${m.imageMessage?.caption || ''}` });
            } else {
                await sock.sendMessage(ownerJid, { video: stream, caption: `${captionPrefix}${m.videoMessage?.caption || ''}` });
            }
        }
    } catch (e) {
        console.error('[AUTOSTATUS] Auto-download error:', e.message);
    }
}

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

function parseEnvBoolean(value, defaultValue) {
    if (value === undefined || value === null || String(value).trim() === '') return defaultValue;
    return String(value).toLowerCase() === 'true';
}

async function getStartupAutoStatusPolicy() {
    const viewValue = await store.getEnvBackedSetting('AUTO_STATUS_VIEW', 'true');
    const reactValue = await store.getEnvBackedSetting('AUTO_STATUS_REACT', 'true');

    return {
        enabled: parseEnvBoolean(viewValue, true),
        reactOn: parseEnvBoolean(reactValue, true)
    };
}

// Get random emoji from STATUS_EMOJIS env variable (comma-separated) with DB fallback.
async function getRandomStatusEmoji() {
    const emojiValue = await store.getEnvBackedSetting('STATUS_EMOJIS', '💙,🖤,⭐');
    const emojis = String(emojiValue || '💙,🖤,⭐').split(',').map(e => e.trim()).filter(Boolean);
    return emojis[Math.floor(Math.random() * emojis.length)];
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
            newsletterName: settings.newsletterName || settings.botName || 'PGWIZ-MD',
            serverMessageId: -1
        }
    }
};

async function readConfig() {
    try {
        const policy = await getStartupAutoStatusPolicy();

        if (HAS_DB) {
            const config = await store.getSetting('global', 'autoStatus');

            // If no config exists, check environment variables for initial setup
            if (!config) {
                const initialConfig = { enabled: policy.enabled, reactOn: policy.reactOn };
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
                const initialConfig = { enabled: policy.enabled, reactOn: policy.reactOn };
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
        const policy = await getStartupAutoStatusPolicy();

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
        return { enabled: true, reactOn: true };
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
        if (!enabled) return;

        const participant = statusKey.participant || (statusKey.remoteJid !== 'status@broadcast' ? statusKey.remoteJid : null);
        if (!participant || participant === 'status@broadcast') {
            return;
        }

        const emoji = await getRandomStatusEmoji();

        const reactionKey = {
            remoteJid: 'status@broadcast',
            id: statusKey.id,
            participant: participant,
            fromMe: Boolean(statusKey.fromMe)
        };

        // Method 1: sendMessage react with sanitized statusJidList
        try {
            await sock.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: reactionKey
                    }
                },
                {
                    statusJidList: [participant]
                }
            );
            console.log(`[AUTOSTATUS] ✅ Reacted ${emoji} to status from ${participant}`);
            return;
        } catch (e1) {
            // Method 2: relayMessage fallback
            await sock.relayMessage(
                'status@broadcast',
                {
                    reactionMessage: {
                        key: reactionKey,
                        text: emoji
                    }
                },
                {
                    messageId: statusKey.id,
                    statusJidList: [participant]
                }
            );
            console.log(`[AUTOSTATUS] ✅ Reacted ${emoji} (relay) to status from ${participant}`);
        }
    } catch (error) {
        console.error('[AUTOSTATUS] ❌ Error reacting to status:', error.message);
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

        // Per-contact ignore list check
        const senderJid = (status.messages?.[0]?.key?.participant || status.messages?.[0]?.key?.remoteJid || '').split('@')[0];
        if (senderJid) {
            const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];
            if (ignoreList.includes(senderJid)) return;
        }

        // Handle Messages (New Statuses)
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                // Deduplicate: Don't react if already reacted
                if (reactedStatuses.has(msg.key.id)) return;

                reactedStatuses.add(msg.key.id);
                await sock.readMessages([msg.key]).catch(() => { });
                reactToStatus(sock, msg.key).catch(() => {});
                handleAutoDownloadStatus(sock, msg).catch(() => {});
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
    usage: '.autostatus <on|off|react on|react off|ignore <num>|unignore <num>|ignored>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            let config = await readConfig();
            const policy = await getStartupAutoStatusPolicy();

            const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];

            if (!args || args.length === 0) {
                const viewStatus = config.enabled ? '✅ Enabled' : '❌ Disabled';
                const reactStatus = config.reactOn ? '✅ Enabled' : '❌ Disabled';

                await sock.sendMessage(chatId, {
                    text: `🔄 *Auto Status Settings*\n\n` +
                        `📱 *Auto Status View:* ${viewStatus}\n` +
                        `💫 *Status Reactions:* ${reactStatus}\n` +
                        `🔒 *Startup Policy (ENV):* View=${policy.enabled ? 'true' : 'false'}, React=${policy.reactOn ? 'true' : 'false'}\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n` +
                        `🚫 *Ignored Contacts:* ${ignoreList.length}\n\n` +
                        `*Note:* This setting is enforced on every startup from .env variables.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            const subCommand = args[0].toLowerCase();

            if (subCommand === 'ignore') {
                const num = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                if (!num) {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Please provide a phone number!*\n\nUsage: `.autostatus ignore 254712345678`',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!ignoreList.includes(num)) ignoreList.push(num);
                await store.saveSetting('global', 'autoStatusIgnoreList', ignoreList);
                await sock.sendMessage(chatId, {
                    text: `🚫 *${num}* has been added to the status ignore list.\nIgnored: ${ignoreList.length} contact(s).`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (subCommand === 'unignore') {
                const num = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                if (!num) {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Please provide a phone number!*\n\nUsage: `.autostatus unignore 254712345678`',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                const newList = ignoreList.filter(n => n !== num);
                await store.saveSetting('global', 'autoStatusIgnoreList', newList);
                const wasIgnored = ignoreList.length !== newList.length;
                await sock.sendMessage(chatId, {
                    text: wasIgnored
                        ? `✅ *${num}* removed from ignore list.\nIgnored: ${newList.length} contact(s).`
                        : `ℹ️ *${num}* was not in the ignore list.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (subCommand === 'ignored') {
                const text = ignoreList.length === 0
                    ? '📋 *No contacts are currently ignored.*'
                    : `📋 *Ignored Contacts (${ignoreList.length}):*\n\n` + ignoreList.map((n, i) => `${i + 1}. ${n}`).join('\n');
                await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, {
                text: '🔒 *Auto status is locked by startup policy.*\n\n' +
                    `AUTO_STATUS_VIEW=${policy.enabled ? 'true' : 'false'}\n` +
                    `AUTO_STATUS_REACT=${policy.reactOn ? 'true' : 'false'}\n\n` +
                    'To change behavior, update .env and restart the bot.\n\n' +
                    '*Ignore list commands:*\n' +
                    '• `.autostatus ignore <num>` - Ignore a contact\n' +
                    '• `.autostatus unignore <num>` - Un-ignore a contact\n' +
                    '• `.autostatus ignored` - List ignored contacts',
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
