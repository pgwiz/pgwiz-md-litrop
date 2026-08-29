const { jidNormalizedUser } = require('@whiskeysockets/baileys');
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

// Get random emoji from STATUS_EMOJIS env variable (comma-separated) or default to 💚
function getRandomStatusEmoji() {
    const emojis = (process.env.STATUS_EMOJIS || '💚,❤️,🔥,😍,👏').split(',').map(e => e.trim()).filter(Boolean);
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
        const envEnabled = process.env.AUTO_STATUS_VIEW !== 'false';
        const envReactOn = process.env.AUTO_STATUS_REACT !== 'false';

        if (HAS_DB) {
            const config = await store.getSetting('global', 'autoStatus');
            if (config && typeof config === 'object') {
                return {
                    enabled: config.enabled !== undefined ? (config.enabled !== false && config.enabled !== 'false') : envEnabled,
                    reactOn: config.reactOn !== undefined ? (config.reactOn !== false && config.reactOn !== 'false') : envReactOn
                };
            }

            const initialConfig = { enabled: envEnabled, reactOn: envReactOn };
            await store.saveSetting('global', 'autoStatus', initialConfig);
            return initialConfig;
        } else {
            if (!fs.existsSync(configPath)) {
                const initialConfig = { enabled: envEnabled, reactOn: envReactOn };
                fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
                return initialConfig;
            }

            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return {
                enabled: config.enabled !== undefined ? (config.enabled !== false && config.enabled !== 'false') : envEnabled,
                reactOn: config.reactOn !== undefined ? (config.reactOn !== false && config.reactOn !== 'false') : envReactOn
            };
        }
    } catch (error) {
        console.error('Error reading auto status config:', error);
        return { enabled: true, reactOn: true };
    }
}

// Helper function to update .env file
function updateEnvFile(key, value) {
    try {
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) return;

        let content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        let found = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#') || !line) continue;

            if (line.startsWith(`${key}=`)) {
                const quotedValue = (value.includes(' ') || value.includes(',') || value.includes('#'))
                    ? `"${value}"`
                    : value;
                lines[i] = `${key}=${quotedValue}`;
                found = true;
                break;
            }
        }

        if (!found) {
            const quotedValue = (value.includes(' ') || value.includes(',') || value.includes('#'))
                ? `"${value}"`
                : value;
            lines.push(`${key}=${quotedValue}`);
        }

        fs.writeFileSync(envPath, lines.join('\n'));
    } catch (error) {
        console.error('[ENV] Error updating .env file:', error.message);
    }
}

async function writeConfig(config) {
    try {
        // 1. Live dynamic in-memory update
        process.env.AUTO_STATUS_VIEW = config.enabled ? 'true' : 'false';
        process.env.AUTO_STATUS_REACT = config.reactOn ? 'true' : 'false';

        // 2. Persist to database/store
        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', config);
        } else {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        // 3. Sync to local .env
        updateEnvFile('AUTO_STATUS_VIEW', config.enabled ? 'true' : 'false');
        updateEnvFile('AUTO_STATUS_REACT', config.reactOn ? 'true' : 'false');

        // 4. Sync to Heroku if credentials present
        let apiKey = process.env.HEROKU_API_KEY || process.env.HEROKU_API_TOKEN;
        let appName = process.env.HEROKU_APP_NAME;
        if (!apiKey || !appName) {
            const storedAuth = await store.getSetting('global', 'herokuAuth');
            if (storedAuth) {
                apiKey = apiKey || storedAuth.apiKey;
                appName = appName || storedAuth.appName;
            }
        }

        if (apiKey && appName) {
            const https = require('https');
            const body = JSON.stringify({
                AUTO_STATUS_VIEW: config.enabled ? 'true' : 'false',
                AUTO_STATUS_REACT: config.reactOn ? 'true' : 'false'
            });
            const req = https.request({
                hostname: 'api.heroku.com',
                port: 443,
                path: `/apps/${appName}/config-vars`,
                method: 'PATCH',
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }, () => {});
            req.on('error', () => {});
            req.write(body);
            req.end();
            console.log(`[AUTOSTATUS] Live synced to Heroku app ${appName}`);
        }
    } catch (error) {
        console.error('Error writing auto status config:', error);
    }
}

async function isAutoStatusEnabled() {
    const config = await readConfig();
    return config.enabled !== false;
}

async function isStatusReactionEnabled() {
    const config = await readConfig();
    return config.reactOn !== false;
}

// Exact tested reaction rhythm (Clean story delivery without DM spam)
async function reactToStatus(sock, statusKey) {
    try {
        const enabled = await isStatusReactionEnabled();
        if (!enabled || !sock) return;

        const rawParticipant = statusKey.participant;
        if (!rawParticipant || rawParticipant === 'status@broadcast') return;

        const emoji = getRandomStatusEmoji();

        const statusReactionKey = {
            remoteJid: 'status@broadcast',
            id: statusKey.id,
            participant: rawParticipant,
            fromMe: false
        };

        const { delay } = require('@whiskeysockets/baileys');

        // 1. Mark Read Receipt on Status Broadcast
        try {
            await sock.readMessages([{
                remoteJid: 'status@broadcast',
                id: statusKey.id,
                participant: rawParticipant
            }]);
            console.log(`[AUTOSTATUS] 👀 [1/3] readMessages sent for ${statusKey.id}`);
        } catch (e) {
            console.log(`[AUTOSTATUS] readMessages notice: ${e.message}`);
        }

        await delay(1000);

        // 2. RelayMessage reaction stanza to status@broadcast
        try {
            await sock.relayMessage(
                'status@broadcast',
                {
                    reactionMessage: {
                        key: statusReactionKey,
                        text: emoji,
                        senderTimestampMs: Date.now()
                    }
                },
                {
                    statusJidList: [rawParticipant]
                }
            );
            console.log(`[AUTOSTATUS] ⚡ [2/3] relayMessage reaction ${emoji} sent`);
        } catch (e) {
            console.log(`[AUTOSTATUS] relayMessage notice: ${e.message}`);
        }

        await delay(1000);

        // 3. SendMessage react stanza to status@broadcast
        try {
            await sock.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: statusReactionKey
                    }
                },
                {
                    statusJidList: [rawParticipant]
                }
            );
            console.log(`[AUTOSTATUS] ⚡ [3/3] sendMessage broadcast reaction ${emoji} sent`);
        } catch (e) {
            console.log(`[AUTOSTATUS] sendMessage broadcast notice: ${e.message}`);
        }

        console.log(`[AUTOSTATUS] ✅ Reaction rhythm (${emoji}) completed for ${statusKey.id} from ${rawParticipant}`);
    } catch (error) {
        console.error('[AUTOSTATUS] ❌ Error in reactToStatus:', error.message);
    }
}

// In-memory + SQLite deduplication set
const reactedStatuses = new Set();

// Sequential queue to process statuses cleanly without interleaving
let statusQueue = [];
let isProcessingQueue = false;

async function processStatusQueue(sock) {
    if (isProcessingQueue || statusQueue.length === 0) return;
    isProcessingQueue = true;

    while (statusQueue.length > 0) {
        const item = statusQueue.shift();
        try {
            await item.handler();
        } catch (err) {
            console.error('[AUTOSTATUS] Queue processing error:', err.message);
        }
    }

    isProcessingQueue = false;
}

async function handleStatusUpdate(sock, status) {
    try {
        const enabled = await isAutoStatusEnabled();
        if (!enabled || !sock) return;

        const msgs = status.messages || (status.key ? [status] : []);
        for (const msg of msgs) {
            const key = msg.key || msg;
            if (!key) continue;

            const isStatus = key.remoteJid === 'status@broadcast' || msg.remoteJid === 'status@broadcast';
            if (!isStatus) continue;

            // Skip own statuses and outbound reaction echoes
            if (key.fromMe || msg.fromMe) continue;

            // 1. Age Guard: Skip historical backlog / old statuses older than 2 minutes (120s)
            const timestamp = Number(msg.messageTimestamp || key.messageTimestamp || 0);
            const nowSec = Math.floor(Date.now() / 1000);
            if (timestamp && (nowSec - timestamp > 120)) {
                console.log(`[AUTOSTATUS] ⏩ Skipping old status backlog ${key.id} (age: ${nowSec - timestamp}s)`);
                continue;
            }

            const unnormParticipant = key.participant 
                || msg.participant 
                || msg.message?.extendedTextMessage?.contextInfo?.participant
                || msg.message?.imageMessage?.contextInfo?.participant
                || msg.message?.videoMessage?.contextInfo?.participant;

            if (!unnormParticipant) {
                continue;
            }

            const rawParticipant = (typeof jidNormalizedUser === 'function') 
                ? jidNormalizedUser(unnormParticipant) 
                : unnormParticipant.split(':')[0] + (unnormParticipant.includes('@lid') ? '@lid' : '@s.whatsapp.net');

            const senderNum = rawParticipant.split('@')[0];

            // Check per-contact ignore list
            if (senderNum) {
                const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];
                if (ignoreList.includes(senderNum)) {
                    console.log(`[AUTOSTATUS] Skipping ignored contact: ${senderNum}`);
                    continue;
                }
            }

            // 2. In-memory & Persistent SQLite Deduplication
            if (reactedStatuses.has(key.id)) {
                continue;
            }
            if (HAS_DB) {
                const alreadyHandled = await store.getSetting('status_history', key.id);
                if (alreadyHandled) {
                    reactedStatuses.add(key.id);
                    continue;
                }
            }

            reactedStatuses.add(key.id);
            if (HAS_DB) {
                await store.saveSetting('status_history', key.id, true).catch(() => {});
            }

            // 3. Push to sequential processing queue
            statusQueue.push({
                handler: async () => {
                    console.log(`[AUTOSTATUS] 📢 Processing live status ${key.id} from ${rawParticipant}`);

                    const targetKey = {
                        remoteJid: 'status@broadcast',
                        id: key.id,
                        participant: rawParticipant,
                        fromMe: false
                    };
                    await reactToStatus(sock, targetKey);

                    if (msg.message) {
                        handleAutoDownloadStatus(sock, msg).catch(() => {});
                    }
                }
            });

            processStatusQueue(sock).catch(() => {});
        }
    } catch (error) {
        console.error('[AUTOSTATUS] ❌ Error in handleStatusUpdate:', error.message);
    }
}

async function applyStartupAutoStatusPolicy() {
    try {
        const config = await readConfig();
        process.env.AUTO_STATUS_VIEW = config.enabled ? 'true' : 'false';
        process.env.AUTO_STATUS_REACT = config.reactOn ? 'true' : 'false';
        console.log(`[AUTOSTATUS] Startup policy applied: View=${config.enabled}, React=${config.reactOn}`);
        return config;
    } catch (e) {
        console.error('[AUTOSTATUS] Error applying startup policy:', e.message);
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
            const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];

            if (!args || args.length === 0) {
                const viewStatus = config.enabled ? '✅ Enabled' : '❌ Disabled';
                const reactStatus = config.reactOn ? '✅ Enabled' : '❌ Disabled';

                await sock.sendMessage(chatId, {
                    text: `🔄 *Auto Status Settings*\n\n` +
                        `📱 *Auto Status View:* ${viewStatus}\n` +
                        `💫 *Status Reactions:* ${reactStatus}\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n` +
                        `🚫 *Ignored Contacts:* ${ignoreList.length}\n\n` +
                        `*Commands:*\n` +
                        `• \`.autostatus on\` - Enable auto view\n` +
                        `• \`.autostatus off\` - Disable auto view\n` +
                        `• \`.autostatus react on\` - Enable reaction\n` +
                        `• \`.autostatus react off\` - Disable reaction\n` +
                        `• \`.autostatus ignore <num>\` - Ignore a contact\n` +
                        `• \`.autostatus unignore <num>\` - Un-ignore a contact\n` +
                        `• \`.autostatus ignored\` - List ignored contacts\n\n` +
                        `_⚡ Changes apply lively in runtime without restart!_`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            const command = args[0].toLowerCase();

            if (command === 'on') {
                config.enabled = true;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: '✅ *Auto status view enabled!*\n⚡ Applied lively in runtime memory.',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'off') {
                config.enabled = false;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: '❌ *Auto status view disabled!*\n⚡ Applied lively in runtime memory.',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'react') {
                if (!args[1]) {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Please specify on/off for reactions!*\n\nUsage: `.autostatus react on/off`',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                const reactCommand = args[1].toLowerCase();

                if (reactCommand === 'on') {
                    config.reactOn = true;
                    await writeConfig(config);

                    await sock.sendMessage(chatId, {
                        text: `💫 *Status reactions enabled!*\nEmojis: ${process.env.STATUS_EMOJIS || '💚,❤️,🔥,😍,👏'}\n⚡ Applied lively in runtime memory.`,
                        ...channelInfo
                    }, { quoted: message });

                } else if (reactCommand === 'off') {
                    config.reactOn = false;
                    await writeConfig(config);

                    await sock.sendMessage(chatId, {
                        text: '❌ *Status reactions disabled!*\n⚡ Applied lively in runtime memory.',
                        ...channelInfo
                    }, { quoted: message });

                } else {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Invalid reaction command!*\n\nUsage: `.autostatus react on/off`',
                        ...channelInfo
                    }, { quoted: message });
                }

            } else if (command === 'ignore') {
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

            } else if (command === 'unignore') {
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

            } else if (command === 'ignored') {
                const text = ignoreList.length === 0
                    ? '📋 *No contacts are currently ignored.*'
                    : `📋 *Ignored Contacts (${ignoreList.length}):*\n\n` + ignoreList.map((n, i) => `${i + 1}. ${n}`).join('\n');
                await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid command!*\n\n' +
                        '*Usage:*\n' +
                        '• `.autostatus on/off` - Enable/disable auto view\n' +
                        '• `.autostatus react on/off` - Enable/disable reactions\n' +
                        '• `.autostatus ignore <num>` - Ignore a contact\n' +
                        '• `.autostatus unignore <num>` - Un-ignore a contact\n' +
                        '• `.autostatus ignored` - List ignored contacts',
                    ...channelInfo
                }, { quoted: message });
            }

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
    applyStartupAutoStatusPolicy,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    reactToStatus,
    readConfig,
    writeConfig
};
