const { downloadMediaMessage, jidNormalizedUser, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = path.join(__dirname, '../data/autoStatus.json');

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

function parseEnvBool(val, fallback = true) {
    if (val === undefined || val === null || String(val).trim() === '') return fallback;
    const s = String(val).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'disabled') return false;
    return fallback;
}

function getStatusEmojis() {
    const envEmojis = process.env.STATUS_EMOJIS || process.env.AUTO_STATUS_EMOJIS || process.env.STATUS_REACTION_EMOJIS;
    if (envEmojis && typeof envEmojis === 'string' && envEmojis.trim() !== '') {
        const parsed = envEmojis.split(',').map(e => e.trim()).filter(Boolean);
        if (parsed.length > 0) return parsed;
    }
    return ['❤️', '🔥', '✨', '💯', '🌟', '⚡', '😍', '👏', '💖', '🥰'];
}

function getRandomStatusEmoji() {
    const emojis = getStatusEmojis();
    return emojis[Math.floor(Math.random() * emojis.length)];
}

async function readConfig() {
    try {
        const envViewRaw = process.env.AUTO_STATUS_VIEW ?? process.env.AUTO_STATUS_READ ?? process.env.AUTO_READ_STATUS;
        const envReactRaw = process.env.AUTO_STATUS_REACT ?? process.env.AUTO_REACT_STATUS ?? process.env.STATUS_REACT;

        const hasEnvView = envViewRaw !== undefined && String(envViewRaw).trim() !== '';
        const hasEnvReact = envReactRaw !== undefined && String(envReactRaw).trim() !== '';

        const envEnabled = parseEnvBool(envViewRaw, true);
        const envReactOn = parseEnvBool(envReactRaw, true);

        if (HAS_DB) {
            const config = await store.getSetting('global', 'autoStatus');
            return {
                enabled: hasEnvView ? envEnabled : (config?.enabled !== undefined ? parseEnvBool(config.enabled, true) : envEnabled),
                reactOn: hasEnvReact ? envReactOn : (config?.reactOn !== undefined ? parseEnvBool(config.reactOn, true) : envReactOn)
            };
        } else {
            if (!fs.existsSync(configPath)) {
                const initialConfig = { enabled: envEnabled, reactOn: envReactOn };
                try {
                    if (!fs.existsSync(path.dirname(configPath))) fs.mkdirSync(path.dirname(configPath), { recursive: true });
                    fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
                } catch {}
                return initialConfig;
            }

            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return {
                    enabled: hasEnvView ? envEnabled : (config?.enabled !== undefined ? parseEnvBool(config.enabled, true) : envEnabled),
                    reactOn: hasEnvReact ? envReactOn : (config?.reactOn !== undefined ? parseEnvBool(config.reactOn, true) : envReactOn)
                };
            } catch {
                return { enabled: envEnabled, reactOn: envReactOn };
            }
        }
    } catch (error) {
        return { enabled: true, reactOn: true };
    }
}

async function writeConfig(config) {
    try {
        if (config.enabled !== undefined) process.env.AUTO_STATUS_VIEW = String(config.enabled);
        if (config.reactOn !== undefined) process.env.AUTO_STATUS_REACT = String(config.reactOn);

        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', config);
        } else {
            if (!fs.existsSync(path.dirname(configPath))) {
                fs.mkdirSync(path.dirname(configPath), { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        // Update local .env
        try {
            const envPath = path.join(__dirname, '../.env');
            if (fs.existsSync(envPath)) {
                let content = fs.readFileSync(envPath, 'utf8');
                if (config.enabled !== undefined) content = upsertEnvKey(content, 'AUTO_STATUS_VIEW', String(config.enabled));
                if (config.reactOn !== undefined) content = upsertEnvKey(content, 'AUTO_STATUS_REACT', String(config.reactOn));
                fs.writeFileSync(envPath, content);
            }
        } catch {}

        // Cloud sync to Heroku & Koyeb
        syncToCloudPlatforms({
            AUTO_STATUS_VIEW: String(config.enabled),
            AUTO_STATUS_REACT: String(config.reactOn)
        }).catch(() => {});

        return true;
    } catch (error) {
        console.error('Error writing auto status config:', error);
        return false;
    }
}

function upsertEnvKey(content, key, value) {
    const lines = content.split('\n');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(key + '=')) {
            lines[i] = key + '=' + value;
            found = true;
            break;
        }
    }
    if (!found) lines.push(key + '=' + value);
    return lines.join('\n');
}

async function syncToCloudPlatforms(varsToSync) {
    try {
        const pgvars = require('./pgvars');
        if (pgvars && typeof pgvars.syncCloudVars === 'function') {
            await pgvars.syncCloudVars(varsToSync);
        }
    } catch {}
}

async function isAutoStatusEnabled() {
    const config = await readConfig();
    return config.enabled !== false;
}

async function isStatusReactionEnabled() {
    const config = await readConfig();
    return config.reactOn !== false;
}

async function handleAutoDownloadStatus(sock, msg) {
    try {
        const isSaveEnabled = await store.getSetting('global', 'autoStatusSave');
        const envSave = process.env.AUTO_STATUS_SAVE || process.env.AUTO_STATUS_DOWNLOAD;
        const enabled = (isSaveEnabled !== undefined && isSaveEnabled !== null) ? Boolean(isSaveEnabled) : (String(envSave).toLowerCase() === 'true');
        if (!enabled) return;

        const ownerNum = settings.ownerNumber || (sock.user?.id ? sock.user.id.split(':')[0] : null);
        if (!ownerNum) return;
        const ownerJid = (Array.isArray(ownerNum) ? ownerNum[0] : ownerNum).replace(/[^0-9]/g, '') + '@s.whatsapp.net';

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

// In-memory deduplication set & queue
const reactedStatuses = new Set();
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

// Core reaction sender with complete 4-vector delivery
async function reactToStatus(sock, statusKey) {
    try {
        if (!sock || !statusKey?.id) return;
        const rawParticipant = statusKey.participant;
        if (!rawParticipant || rawParticipant === 'status@broadcast') return;

        const normParticipant = (typeof jidNormalizedUser === 'function')
            ? jidNormalizedUser(rawParticipant)
            : rawParticipant.split(':')[0] + '@s.whatsapp.net';

        const emoji = getRandomStatusEmoji();
        const statusReactionKey = {
            remoteJid: 'status@broadcast',
            id: statusKey.id,
            participant: rawParticipant,
            fromMe: false
        };

        const targetList = Array.from(new Set([rawParticipant, normParticipant])).filter(Boolean);

        // Vector 1: RelayMessage to status@broadcast (Standard Multi-Device Status Reaction Stanza)
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
                    statusJidList: targetList
                }
            );
            console.log(`[AUTOSTATUS] ⚡ [1/4] relayMessage status reaction (${emoji}) sent for ${statusKey.id}`);
        } catch (e1) {
            console.log(`[AUTOSTATUS] Vector 1 notice: ${e1.message}`);
        }

        // Vector 2: SendMessage to status@broadcast with react content
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
                    statusJidList: targetList
                }
            );
            console.log(`[AUTOSTATUS] ⚡ [2/4] sendMessage status reaction (${emoji}) sent for ${statusKey.id}`);
        } catch (e2) {
            console.log(`[AUTOSTATUS] Vector 2 notice: ${e2.message}`);
        }

        // Vector 3: RelayMessage reaction directly to the participant's user chat
        try {
            await sock.relayMessage(
                normParticipant,
                {
                    reactionMessage: {
                        key: statusReactionKey,
                        text: emoji,
                        senderTimestampMs: Date.now()
                    }
                },
                {}
            );
            console.log(`[AUTOSTATUS] ⚡ [3/4] direct user relay reaction (${emoji}) sent to ${normParticipant}`);
        } catch (e3) {
            console.log(`[AUTOSTATUS] Vector 3 notice: ${e3.message}`);
        }

        // Vector 4: SendMessage reaction directly to the participant's user chat
        try {
            await sock.sendMessage(
                normParticipant,
                {
                    react: {
                        text: emoji,
                        key: statusReactionKey
                    }
                }
            );
            console.log(`[AUTOSTATUS] ⚡ [4/4] direct user sendMessage reaction (${emoji}) sent to ${normParticipant}`);
        } catch (e4) {
            console.log(`[AUTOSTATUS] Vector 4 notice: ${e4.message}`);
        }

        console.log(`[AUTOSTATUS] ✅ All 4 reaction vectors completed for status ${statusKey.id} from ${normParticipant} (${emoji})`);
    } catch (error) {
        console.error('[AUTOSTATUS] Error in reactToStatus:', error.message);
    }
}

// Full status update listener
async function handleStatusUpdate(sock, status) {
    try {
        if (!sock) return;
        const config = await readConfig();

        // If both view and react are off, exit
        if (config.enabled === false && config.reactOn === false) return;

        const msgs = status.messages || (status.key ? [status] : []);
        for (const msg of msgs) {
            const key = msg.key || msg;
            if (!key) continue;

            const isStatus = key.remoteJid === 'status@broadcast' || msg.remoteJid === 'status@broadcast';
            if (!isStatus) continue;

            // Skip own statuses and reaction echoes
            if (key.fromMe || msg.fromMe) continue;

            // Skip reaction message events to prevent loops
            if (msg.message?.reactionMessage) continue;

            // 1. Age Guard: Allow up to 24 hours (86400s) for WhatsApp statuses
            let ts = msg.messageTimestamp || key.messageTimestamp || 0;
            if (typeof ts === 'object' && ts !== null) ts = ts.low || (ts.toNumber ? ts.toNumber() : 0);
            ts = Number(ts) || 0;
            const nowSec = Math.floor(Date.now() / 1000);
            if (ts > 0 && (nowSec - ts > 86400)) {
                console.log(`[AUTOSTATUS] ⏩ Skipping status older than 24h: ${key.id}`);
                continue;
            }

            const unnormParticipant = key.participant 
                || msg.participant 
                || msg.message?.extendedTextMessage?.contextInfo?.participant
                || msg.message?.imageMessage?.contextInfo?.participant
                || msg.message?.videoMessage?.contextInfo?.participant
                || msg.message?.audioMessage?.contextInfo?.participant;

            if (!unnormParticipant || unnormParticipant === 'status@broadcast') continue;

            const rawParticipant = unnormParticipant;
            const normParticipant = (typeof jidNormalizedUser === 'function') 
                ? jidNormalizedUser(unnormParticipant) 
                : unnormParticipant.split(':')[0] + (unnormParticipant.includes('@lid') ? '@lid' : '@s.whatsapp.net');

            const senderNum = normParticipant.split('@')[0];

            // Check per-contact ignore list
            if (senderNum) {
                const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];
                if (ignoreList.includes(senderNum)) {
                    console.log(`[AUTOSTATUS] Skipping ignored contact: ${senderNum}`);
                    continue;
                }
            }

            // 2. Deduplication check
            if (reactedStatuses.has(key.id)) continue;
            if (HAS_DB) {
                const alreadyHandled = await store.getSetting('status_history', key.id);
                if (alreadyHandled) {
                    reactedStatuses.add(key.id);
                    continue;
                }
            }

            reactedStatuses.add(key.id);

            // 3. Process status viewing and/or reacting
            statusQueue.push({
                handler: async () => {
                    console.log(`[AUTOSTATUS] 📢 Processing status ${key.id} from ${normParticipant}`);

                    const targetKey = {
                        remoteJid: 'status@broadcast',
                        id: key.id,
                        participant: rawParticipant,
                        fromMe: false
                    };

                    // Step A: Mark Read / Seen Receipt (if view is enabled)
                    if (config.enabled !== false) {
                        try {
                            await sock.readMessages([targetKey]);
                            if (typeof sock.sendReceipt === 'function') {
                                await sock.sendReceipt('status@broadcast', rawParticipant, [key.id], 'read-self').catch(() => {});
                                await sock.sendReceipt('status@broadcast', rawParticipant, [key.id], 'read').catch(() => {});
                                await sock.sendReceipt('status@broadcast', normParticipant, [key.id], 'read').catch(() => {});
                            }
                            console.log(`[AUTOSTATUS] 👀 [Viewed] Status ${key.id} marked as seen for ${normParticipant}`);
                        } catch (viewErr) {
                            console.log(`[AUTOSTATUS] View receipt note: ${viewErr.message}`);
                        }
                    }

                    // Step B: React to Status (reacting ALSO marks status seen on WhatsApp)
                    if (config.reactOn !== false) {
                        await reactToStatus(sock, targetKey);
                    }

                    // Save to persistent database history
                    if (HAS_DB) {
                        await store.saveSetting('status_history', key.id, true).catch(() => {});
                    }

                    // Step C: Auto-Download Media (if enabled)
                    if (msg.message) {
                        handleAutoDownloadStatus(sock, msg).catch(() => {});
                    }
                }
            });

            processStatusQueue(sock).catch(() => {});
        }
    } catch (error) {
        console.error('[AUTOSTATUS] Error in handleStatusUpdate:', error.message);
    }
}

async function applyStartupAutoStatusPolicy() {
    try {
        const config = await readConfig();
        process.env.AUTO_STATUS_VIEW = config.enabled ? 'true' : 'false';
        process.env.AUTO_STATUS_REACT = config.reactOn ? 'true' : 'false';
        console.log(`[AUTOSTATUS] Startup policy applied: View=${config.enabled}, React=${config.reactOn}, Emojis=${getStatusEmojis().join(',')}`);
        return config;
    } catch (e) {
        console.error('[AUTOSTATUS] Error applying startup policy:', e.message);
    }
}

module.exports = {
    command: 'autostatus',
    aliases: ['autoview', 'statusview', 'statusreact', 'autoreactstatus'],
    category: 'owner',
    description: 'Automatically view and react to WhatsApp statuses',
    usage: '.autostatus <on|off|view <on|off>|react <on|off>|emoji <emojis>|ignore <num>|unignore <num>|ignored>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            let config = await readConfig();
            const ignoreList = (await store.getSetting('global', 'autoStatusIgnoreList')) || [];

            if (!args || args.length === 0) {
                const viewStatus = config.enabled ? '✅ Enabled' : '❌ Disabled';
                const reactStatus = config.reactOn ? '✅ Enabled' : '❌ Disabled';
                const emojis = getStatusEmojis().join(' ');

                await sock.sendMessage(chatId, {
                    text: `🔄 *Auto Status Settings*\n\n` +
                        `📱 *Auto Status View:* ${viewStatus}\n` +
                        `💫 *Status Reactions:* ${reactStatus}\n` +
                        `✨ *Reaction Emojis:* ${emojis}\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n` +
                        `🚫 *Ignored Contacts:* ${ignoreList.length}\n\n` +
                        `*Commands:*\n` +
                        `• \`.autostatus on\` - Enable both auto view & reaction\n` +
                        `• \`.autostatus off\` - Disable both\n` +
                        `• \`.autostatus view <on|off>\` - Toggle viewing only\n` +
                        `• \`.autostatus react <on|off>\` - Toggle reactions\n` +
                        `• \`.autostatus emoji ❤️,🔥,✨,💯\` - Customize emojis\n` +
                        `• \`.autostatus ignore <num>\` - Ignore a contact\n` +
                        `• \`.autostatus unignore <num>\` - Un-ignore contact\n` +
                        `• \`.autostatus ignored\` - List ignored contacts\n\n` +
                        `_⚡ Changes apply instantly in runtime memory._`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            const command = args[0].toLowerCase();

            if (command === 'on' || command === 'enable') {
                config.enabled = true;
                config.reactOn = true;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: '✅ *Auto status view and reactions enabled!*\n⚡ Applied lively in runtime memory.',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'off' || command === 'disable') {
                config.enabled = false;
                config.reactOn = false;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: '❌ *Auto status view and reactions disabled!*\n⚡ Applied lively in runtime memory.',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'view') {
                const sub = (args[1] || 'on').toLowerCase();
                const enabled = sub === 'on' || sub === 'true' || sub === '1' || sub === 'enable';
                config.enabled = enabled;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: enabled ? '✅ *Auto status view enabled!*' : '❌ *Auto status view disabled!*',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'react') {
                const sub = (args[1] || 'on').toLowerCase();
                const reactOn = sub === 'on' || sub === 'true' || sub === '1' || sub === 'enable';
                config.reactOn = reactOn;
                await writeConfig(config);

                await sock.sendMessage(chatId, {
                    text: reactOn 
                        ? `💫 *Status reactions enabled!*\nEmojis: ${getStatusEmojis().join(' ')}`
                        : '❌ *Status reactions disabled!*',
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'emoji' || command === 'emojis') {
                const emojiList = args.slice(1).join(' ').trim();
                if (!emojiList) {
                    await sock.sendMessage(chatId, {
                        text: `✨ *Current Emojis:* ${getStatusEmojis().join(' ')}\n\nUsage: \`.autostatus emoji ❤️,🔥,✨,💯,🌟,⚡\``,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                process.env.STATUS_EMOJIS = emojiList;
                if (HAS_DB) await store.saveSetting('global', 'statusEmojis', emojiList);
                syncToCloudPlatforms({ STATUS_EMOJIS: emojiList }).catch(() => {});

                await sock.sendMessage(chatId, {
                    text: `✅ *Status Reaction Emojis Updated!*\n\n✨ *New Emojis:* ${emojiList}\n⚡ Applied lively in runtime memory.`,
                    ...channelInfo
                }, { quoted: message });

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
                    text: `🚫 *+${num}* added to status ignore list.\nIgnored: ${ignoreList.length} contact(s).`,
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
                        ? `✅ *+${num}* removed from ignore list.\nIgnored: ${newList.length} contact(s).`
                        : `ℹ️ *+${num}* was not in the ignore list.`,
                    ...channelInfo
                }, { quoted: message });

            } else if (command === 'ignored') {
                const text = ignoreList.length === 0
                    ? '📋 *No contacts are currently ignored.*'
                    : `📋 *Ignored Contacts (${ignoreList.length}):*\n\n` + ignoreList.map((n, i) => `${i + 1}. +${n}`).join('\n');
                await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid autostatus command!*\n\nType `.autostatus` to view all options.',
                    ...channelInfo
                }, { quoted: message });
            }

        } catch (error) {
            console.error('Error in autostatus command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error managing auto status:* ' + error.message,
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
