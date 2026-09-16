const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const settings = require('../settings');

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = path.join(__dirname, '../data/autoStatus.json');

const STRATEGY_DESCRIPTIONS = {
    1: 'Classic Relay to Broadcast (status messageId)',
    2: 'Fresh ID Broadcast Relay (multi-device list)',
    3: 'Direct Author 1:1 Relay',
    4: 'Direct Author Native React',
    5: 'Normalized Phone Broadcast Relay',
    6: 'Native Broadcast React (sendMessage with statusJidList)',
    7: 'Native Broadcast with senderTimestampMs & userJid',
    8: 'Direct 1:1 Relay with senderTimestampMs & fresh tag',
    9: 'Direct 1:1 Quote-Status Context Message',
    10: 'Broadcast Relay with groupingKey & senderTimestampMs',
    11: 'Direct LID Relay (targeted to author LID with senderTimestampMs)',
    12: 'Direct LID Native React (sendMessage to author LID with status key)'
};

const STRATEGY_DEFAULT_EMOJIS = {
    1: '❤️',
    2: '🔥',
    3: '🌟',
    4: '👏',
    5: '💚',
    6: '⚡',
    7: '😭',
    8: '👀',
    9: '🎉',
    10: '💯',
    11: '🚀',
    12: '😍'
};

const DEFAULTS = {
    view: true,
    react: true,
    reaction: '💯',
    strategy: 10,
    emojis: ['❤️', '🔥', '✨', '💯', '🌟', '⚡', '😍', '👏', '💖', '🥰', '👍', '🎉']
};

if (!HAS_DB && !fs.existsSync(configPath)) {
    try {
        if (!fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2));
    } catch {}
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

function parseEnvBool(val, fallback = true) {
    if (val === undefined || val === null || String(val).trim() === '') return fallback;
    const s = String(val).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'disabled') return false;
    return fallback;
}

// In-Memory RAM Caching for sub-millisecond status processing
let _cachedConfig = null;
let _cachedConfigTime = 0;
let _cachedIgnoreList = null;
let _cachedIgnoreTime = 0;

async function readConfig() {
    const now = Date.now();
    if (_cachedConfig && (now - _cachedConfigTime < 5000)) {
        return _cachedConfig;
    }

    try {
        const envViewRaw = process.env.AUTO_STATUS_VIEW ?? process.env.AUTO_STATUS_READ ?? process.env.AUTO_READ_STATUS;
        const envReactRaw = process.env.AUTO_STATUS_REACT ?? process.env.AUTO_REACT_STATUS;
        const envStrategyRaw = process.env.AUTO_STATUS_STRATEGY;

        const hasEnvView = envViewRaw !== undefined && String(envViewRaw).trim() !== '';
        const hasEnvReact = envReactRaw !== undefined && String(envReactRaw).trim() !== '';
        const hasEnvStrategy = envStrategyRaw !== undefined && !isNaN(parseInt(envStrategyRaw, 10));

        let data = DEFAULTS;
        if (HAS_DB) {
            const stored = await store.getSetting('global', 'autoStatus').catch(() => null);
            if (stored) data = stored;
        } else if (fs.existsSync(configPath)) {
            try {
                data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch {}
        }

        _cachedConfig = {
            view: hasEnvView ? parseEnvBool(envViewRaw, true) : (data.view !== undefined ? parseEnvBool(data.view, true) : (data.enabled !== undefined ? parseEnvBool(data.enabled, true) : true)),
            react: hasEnvReact ? parseEnvBool(envReactRaw, true) : (data.react !== undefined ? parseEnvBool(data.react, true) : (data.reactOn !== undefined ? parseEnvBool(data.reactOn, true) : true)),
            reaction: data.reaction || '💯',
            strategy: hasEnvStrategy ? parseInt(envStrategyRaw, 10) : (Number(data.strategy) || 10),
            emojis: data.emojis || DEFAULTS.emojis
        };
        _cachedConfigTime = now;
        return _cachedConfig;
    } catch (e) {
        return { ...DEFAULTS };
    }
}

async function writeConfig(config) {
    try {
        _cachedConfig = null;
        _cachedConfigTime = 0;

        if (config.view !== undefined) process.env.AUTO_STATUS_VIEW = String(config.view);
        if (config.react !== undefined) process.env.AUTO_STATUS_REACT = String(config.react);
        if (config.strategy !== undefined) process.env.AUTO_STATUS_STRATEGY = String(config.strategy);

        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', config);
        } else {
            if (!fs.existsSync(path.dirname(configPath))) {
                fs.mkdirSync(path.dirname(configPath), { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
        return true;
    } catch (e) {
        console.error('[autostatus] Error writing config:', e.message);
        return false;
    }
}

async function getCachedIgnoreList() {
    const now = Date.now();
    if (_cachedIgnoreList && (now - _cachedIgnoreTime < 5000)) {
        return _cachedIgnoreList;
    }
    try {
        if (HAS_DB) {
            _cachedIgnoreList = (await store.getSetting('global', 'autoStatusIgnoreList').catch(() => [])) || [];
        } else {
            _cachedIgnoreList = [];
        }
    } catch {
        _cachedIgnoreList = [];
    }
    _cachedIgnoreTime = now;
    return _cachedIgnoreList;
}

async function isAutoStatusEnabled() {
    const cfg = await readConfig();
    return cfg.view !== false;
}

async function isStatusReactionEnabled() {
    const cfg = await readConfig();
    return cfg.react !== false;
}

function getStatusEmoji(cfg) {
    const envEmoji = process.env.STATUS_REACTION || process.env.STATUS_EMOJI;
    if (envEmoji && envEmoji.trim() !== '') return envEmoji.trim();
    return cfg.reaction || '💚';
}

// Track reacted statuses to prevent duplicate reaction stanzas
const reactedStatusKeys = new Set();
setInterval(() => {
    if (reactedStatusKeys.size > 2000) reactedStatusKeys.clear();
}, 60000);

// Rich Status Event History & LID Discovery
const statusStats = {
    totalReceived: 0,
    totalViewed: 0,
    totalReacted: 0,
    totalErrors: 0,
    startTime: Date.now()
};

const distinctLids = new Map(); // participant -> { id, isLid, pushName, firstSeen, lastSeen, count, lastMsgId }
const recentStatusHistory = []; // array of last 100 status items (newest at index 0)
const MAX_HISTORY_ITEMS = 100;

// In-memory cache of recent status messages per participant/number
const recentStatusCache = new Map();

function trackStatusEvent(msg, key, options = {}) {
    if (!key || !key.id) return null;
    const isFromMe = !!(key.fromMe || msg?.fromMe || options.isFromMe);
    let participant = key.participant;
    if (!participant || participant === 'status@broadcast') {
        if (isFromMe) {
            participant = global.botInstance?.user?.id ? global.botInstance.user.id.replace(/:\d+@/, '@') : 'bot@s.whatsapp.net';
        } else {
            participant = key.remoteJid || 'unknown@broadcast';
        }
    }

    statusStats.totalReceived++;

    const isLid = participant.includes('@lid');
    const pushName = msg?.pushName || (isFromMe ? 'Myself (Bot)' : null);
    const now = Date.now();

    // Update distinct participant record
    const existing = distinctLids.get(participant) || {
        id: participant,
        isLid,
        pushName: pushName,
        firstSeen: new Date(now).toISOString(),
        lastSeen: new Date(now).toISOString(),
        count: 0,
        lastMsgId: key.id
    };
    existing.count++;
    existing.lastSeen = new Date(now).toISOString();
    existing.lastMsgId = key.id;
    if (pushName && !existing.pushName) existing.pushName = pushName;
    distinctLids.set(participant, existing);

    // Also index by phone number if present
    const num = participant.split('@')[0];
    if (num) {
        recentStatusCache.set(num, key);
    }
    recentStatusCache.set(participant, key);
    if (recentStatusCache.size > 500) {
        const firstKey = recentStatusCache.keys().next().value;
        recentStatusCache.delete(firstKey);
    }

    // Extract message preview
    let msgType = 'unknown';
    let textPreview = '';
    if (msg?.message) {
        const typeKey = Object.keys(msg.message)[0];
        msgType = typeKey;
        if (typeKey === 'imageMessage') {
            textPreview = msg.message.imageMessage?.caption || '[Image Status]';
        } else if (typeKey === 'videoMessage') {
            textPreview = msg.message.videoMessage?.caption || '[Video Status]';
        } else if (typeKey === 'extendedTextMessage') {
            textPreview = msg.message.extendedTextMessage?.text || '[Text Status]';
        } else if (typeKey === 'audioMessage') {
            textPreview = '[Audio/Voice Note Status]';
        } else {
            textPreview = `[${typeKey}]`;
        }
    }

    const historyItem = {
        id: key.id,
        sender: participant,
        isLid,
        fromMe: isFromMe,
        pushName,
        type: msgType,
        preview: (textPreview || '').substring(0, 120),
        receivedAt: new Date(now).toISOString(),
        timestampMs: now,
        messageTimestamp: msg?.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(now / 1000),
        viewStatus: options.viewStatus || 'pending',
        reactStatus: options.reactStatus || 'pending',
        strategyUsed: options.strategyUsed || null,
        emojiUsed: options.emojiUsed || null,
        error: options.error || null
    };

    recentStatusHistory.unshift(historyItem);
    if (recentStatusHistory.length > MAX_HISTORY_ITEMS) {
        recentStatusHistory.pop();
    }

    return historyItem;
}

function cacheRecentStatus(key) {
    if (!key || !key.id) return;
    const participant = key.participant || key.remoteJid;
    if (participant && participant !== 'status@broadcast') {
        recentStatusCache.set(participant, key);
        const num = participant.split('@')[0];
        if (num) recentStatusCache.set(num, key);
    }
    if (recentStatusCache.size > 500) {
        const firstKey = recentStatusCache.keys().next().value;
        recentStatusCache.delete(firstKey);
    }
}

/**
 * Execute a specific Baileys status reaction strategy (1 to 12)
 */
async function executeReactionStrategy(sock, strategyNum, statusKey, emoji) {
    const rawParticipant = statusKey.participant || statusKey.remoteJid;
    if (!rawParticipant || rawParticipant === 'status@broadcast') {
        throw new Error('Invalid status participant');
    }

    const isLid = rawParticipant.includes('@lid');

    // Resolve phone JID ONLY if genuine @s.whatsapp.net is available (never fabricate fake @s.whatsapp.net from LID numbers)
    let phoneJid = '';
    if (statusKey.participantPn && statusKey.participantPn.includes('@s.whatsapp.net')) {
        phoneJid = statusKey.participantPn;
    } else if (rawParticipant.includes('@s.whatsapp.net')) {
        phoneJid = rawParticipant;
    } else if (global.lidJidMap && global.lidJidMap.has(rawParticipant)) {
        phoneJid = global.lidJidMap.get(rawParticipant);
    }

    const userPhone = sock.user?.id ? (sock.user.id.replace(/:\d+@/, '@').split('@')[0] + '@s.whatsapp.net') : '';
    const userLid = sock.user?.lid ? sock.user.lid.replace(/:\d+@/, '@') : '';
    const nowMs = Date.now();

    const reactionKey = {
        remoteJid: 'status@broadcast',
        id: statusKey.id,
        participant: rawParticipant,
        fromMe: false
    };

    // Guarantee Signal cryptographic session exists for recipient (crucial for cloud instances with fresh sessions)
    if (typeof sock.assertSessions === 'function') {
        try {
            await sock.assertSessions([rawParticipant], true);
        } catch (_) {}
    }

    switch (Number(strategyNum)) {
        case 1: {
            // Strategy 1: Classic Upstream Relay to status@broadcast
            const statusJidList = [rawParticipant].filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji
                }
            }, {
                messageId: statusKey.id,
                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 2: {
            // Strategy 2: Fresh generated Message ID Relay to status@broadcast with multi-identifier list
            const statusJidList = Array.from(new Set([rawParticipant, phoneJid, userPhone, userLid])).filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji
                }
            }, {
                statusJidList
            });
        }
        case 3: {
            // Strategy 3: Direct Author 1:1 Relay
            return await sock.relayMessage(rawParticipant, {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji
                }
            }, {});
        }
        case 4: {
            // Strategy 4: Direct Author Native React
            return await sock.sendMessage(rawParticipant, {
                react: {
                    text: emoji,
                    key: reactionKey
                }
            });
        }
        case 5: {
            // Strategy 5: Normalized Phone Broadcast Relay
            const targetJid = phoneJid || rawParticipant;
            const statusJidList = [targetJid].filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: targetJid,
                        fromMe: false
                    },
                    text: emoji
                }
            }, {
                messageId: statusKey.id,
                statusJidList
            });
        }
        case 6: {
            // Strategy 6: Broadcast Relay with multi-identifier statusJidList and senderTimestampMs
            const statusJidList = Array.from(new Set([rawParticipant, phoneJid, userPhone, userLid])).filter(j => j && j !== 'status@broadcast');

            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {
                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 7: {
            // Strategy 7: Broadcast Relay with groupingKey and timestamped reaction
            const statusJidList = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    groupingKey: rawParticipant,
                    senderTimestampMs: nowMs
                }
            }, {
                statusJidList
            });
        }
        case 8: {
            // Strategy 8: Direct 1:1 Relay to Phone JID with senderTimestampMs & fresh messageId
            const target = phoneJid || rawParticipant;
            return await sock.relayMessage(target, {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {});
        }
        case 9: {
            // Strategy 9: Direct 1:1 Quote-Status Context Message (Fallback reply to status in DM)
            const target = phoneJid || rawParticipant;
            return await sock.sendMessage(target, {
                text: emoji,
                contextInfo: {
                    stanzaId: statusKey.id,
                    participant: rawParticipant,
                    quotedMessage: { conversation: "status" },
                    remoteJid: 'status@broadcast'
                }
            });
        }
        case 10: {
            // Strategy 10: Direct 1:1 E2E Author Reaction with Broadcast Relay Fallback
            // (Official WhatsApp Web & Mobile MD specification for status reactions)
            try {
                return await sock.sendMessage(rawParticipant, {
                    react: {
                        text: emoji,
                        key: reactionKey,
                        senderTimestampMs: nowMs
                    }
                });
            } catch (err) {
                // Fallback 1: 1:1 Direct Relay to Author JID/LID
                try {
                    return await sock.relayMessage(rawParticipant, {
                        reactionMessage: {
                            key: reactionKey,
                            text: emoji,
                            groupingKey: rawParticipant,
                            senderTimestampMs: nowMs
                        }
                    }, {});
                } catch (relayErr) {
                    // Fallback 2: Broadcast story relay
                    const statusJidList = [rawParticipant].filter(j => j && j !== 'status@broadcast');
                    return await sock.relayMessage('status@broadcast', {
                        reactionMessage: {
                            key: reactionKey,
                            text: emoji,
                            senderTimestampMs: nowMs
                        }
                    }, {
                        messageId: statusKey.id,
                        statusJidList
                    });
                }
            }
        }
        case 11: {
            // Strategy 11: Direct LID Relay (targeted directly to author's LID with senderTimestampMs)
            return await sock.relayMessage(rawParticipant, {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {});
        }
        case 12: {
            // Strategy 12: Direct LID Native React (sendMessage to author LID with status key)
            return await sock.sendMessage(rawParticipant, {
                react: {
                    text: emoji,
                    key: reactionKey
                }
            });
        }
        default:
            throw new Error(`Unknown strategy: ${strategyNum} (Valid: 1 to 12)`);
    }
}

async function reactToStatus(sock, statusKey, customEmoji = null, customStrategy = null) {
    try {
        if (!sock || !statusKey?.id) return false;
        const enabled = customEmoji ? true : await isStatusReactionEnabled();
        if (!enabled) return false;

        const cfg = await readConfig();
        const emoji = customEmoji || getStatusEmoji(cfg);
        const strat = Number(customStrategy) || Number(cfg.strategy) || 10;

        await executeReactionStrategy(sock, strat, statusKey, emoji);
        console.log(`[AUTOSTATUS] ✅ Reacted to status ${statusKey.id} from ${statusKey.participant || 'contact'} with ${emoji} (Strategy ${strat})`);
        return true;
    } catch (error) {
        console.error(`[AUTOSTATUS] ❌ Error reacting to status (Strategy ${customStrategy || 'default'}):`, error.message);
        return false;
    }
}

/**
 * Ultra-low-latency concurrent status handler
 */
async function handleStatusUpdate(sock, status) {
    try {
        if (!sock) return;
        const config = await readConfig();
        if (!config.view && !config.react) return;

        const msgs = status.messages || (status.key ? [status] : (status.reaction?.key ? [status.reaction] : []));
        if (!msgs || msgs.length === 0) return;

        const ignoreList = await getCachedIgnoreList();

        const tasks = msgs.map(async (msg) => {
            const key = msg.key || msg;
            if (!key || key.remoteJid !== 'status@broadcast') return;
            if (msg.message?.reactionMessage) return;

            const isFromMe = !!(key.fromMe || msg.fromMe);
            const msgId = key.id;

            // Track status event and discover sender LID/JID (even for own statuses)
            const historyEntry = trackStatusEvent(msg, key, {
                isFromMe,
                viewStatus: isFromMe ? 'own status (skipped)' : 'pending',
                reactStatus: isFromMe ? 'own status (skipped)' : 'pending'
            });

            if (isFromMe) {
                console.log(`[AUTOSTATUS] ℹ️ Received own status broadcast ${msgId} (fromMe: true)`);
                return;
            }

            if (reactedStatusKeys.has(msgId)) return;
            reactedStatusKeys.add(msgId);

            // Check ignore list
            const senderNum = (key.participant || '').split('@')[0];
            if (senderNum && ignoreList.includes(senderNum)) {
                if (historyEntry) {
                    historyEntry.viewStatus = 'ignored';
                    historyEntry.reactStatus = 'ignored';
                }
                return;
            }

            // Execute View and React concurrently (zero artificial delay)
            const actions = [];
            if (config.view) {
                const nowSec = Math.floor(Date.now() / 1000).toString();
                actions.push(
                    (async () => {
                        try {
                            if (typeof sock.sendNode === 'function') {
                                await sock.sendNode({
                                    tag: 'receipt',
                                    attrs: {
                                        id: key.id,
                                        to: 'status@broadcast',
                                        participant: key.participant || key.remoteJid,
                                        type: 'read',
                                        t: nowSec
                                    }
                                });
                            }
                        } catch (_) {
                            if (typeof sock.sendReceipt === 'function') {
                                await sock.sendReceipt('status@broadcast', key.participant || key.remoteJid, [key.id], 'read').catch(() => {});
                            }
                        }
                        return sock.readMessages([key]).catch(() => {});
                    })()
                        .then(() => {
                            statusStats.totalViewed++;
                            if (historyEntry) historyEntry.viewStatus = 'viewed';
                            console.log(`[AUTOSTATUS] 👀 Viewed status ${key.id} from ${key.participant || 'contact'}`);
                        })
                        .catch(() => {
                            if (historyEntry) historyEntry.viewStatus = 'failed';
                        })
                );
            } else {
                if (historyEntry) historyEntry.viewStatus = 'disabled';
            }

            if (config.react) {
                const strat = Number(config.strategy) || 10;
                const emoji = getStatusEmoji(config);
                if (historyEntry) {
                    historyEntry.strategyUsed = strat;
                    historyEntry.emojiUsed = emoji;
                }
                actions.push(
                    reactToStatus(sock, key, emoji, strat)
                        .then((success) => {
                            if (success) {
                                statusStats.totalReacted++;
                                if (historyEntry) historyEntry.reactStatus = 'reacted';
                            } else {
                                statusStats.totalErrors++;
                                if (historyEntry) historyEntry.reactStatus = 'failed';
                            }
                        })
                        .catch(err => {
                            statusStats.totalErrors++;
                            if (historyEntry) {
                                historyEntry.reactStatus = 'failed';
                                historyEntry.error = err.message;
                            }
                            console.error(`[AUTOSTATUS] ❌ React error for ${key.id}:`, err.message);
                        })
                );
            } else {
                if (historyEntry) historyEntry.reactStatus = 'disabled';
            }

            await Promise.allSettled(actions);
        });

        await Promise.allSettled(tasks);
    } catch (error) {
        console.error('[AUTOSTATUS] ❌ Error in handleStatusUpdate:', error.message);
    }
}

module.exports = {
    command: 'autostatus',
    aliases: ['astatus', 'asv', 'autoview', 'statusview'],
    category: 'owner',
    description: 'Auto view and react to status updates (owner only)',
    usage: '.autostatus [view on/off] [react on/off] [strategy <1-12>] [reaction <emoji>] [readreceipts on/off]',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const cfg = await readConfig();
            const ignoreList = (HAS_DB ? await store.getSetting('global', 'autoStatusIgnoreList') : []) || [];
            const activeStrategyName = STRATEGY_DESCRIPTIONS[cfg.strategy] || STRATEGY_DESCRIPTIONS[6];

            if (!args || args.length === 0) {
                let privacyNote = '';
                try {
                    const privacy = await sock.fetchPrivacySettings?.();
                    const rr = privacy?.readreceipts || 'unknown';
                    privacyNote = rr !== 'all'
                        ? `\n⚠️ *Bot Read Receipts:* *${rr}* (Status posters may NOT see views. Type \`.autostatus readreceipts on\` to fix)`
                        : `\n✅ *Bot Read Receipts:* *${rr}* (Views visible to status posters)`;
                } catch (_) {}

                return await sock.sendMessage(chatId, {
                    text: `📱 *AutoStatus Settings*\n\n` +
                        `👁️ *Auto View:* *${cfg.view ? 'ON' : 'OFF'}* (Views status updates immediately)\n` +
                        `💫 *Auto React:* *${cfg.react ? 'ON' : 'OFF'}* (Reacts to status updates)\n` +
                        `✨ *Reaction Emoji:* ${cfg.reaction}\n` +
                        `⚙️ *Reaction Strategy:* *Strategy ${cfg.strategy}* (${activeStrategyName})\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n` +
                        `🚫 *Ignored Contacts:* ${ignoreList.length}` +
                        privacyNote + `\n\n` +
                        `*Commands:*\n` +
                        `• \`.autostatus view on/off\` - Toggle status viewing\n` +
                        `• \`.autostatus react on/off\` - Toggle status reaction\n` +
                        `• \`.autostatus strategy <1-12>\` - Set reaction strategy (1 to 12)\n` +
                        `• \`.autostatus reaction <emoji>\` - Set status reaction emoji\n` +
                        `• \`.autostatus readreceipts on/off\` - Toggle WhatsApp read receipts privacy\n` +
                        `• \`.autostatus on/off\` - Global toggle\n` +
                        `• \`.autostatus ignore <number>\` - Exclude contact\n` +
                        `• \`.autostatus unignore <number>\` - Remove contact\n` +
                        `• \`.autostatus ignored\` - List excluded contacts\n\n` +
                        `*🧪 Diagnostic Probes (Hidden Dev Tools):*\n` +
                        `• \`.autostatus dev <1-12> [emoji]\` - Test specific reaction strategy on status\n` +
                        `• \`.autostatus dev new [emoji]\` - Test NEW strategies (7 to 12) sequentially\n` +
                        `• \`.autostatus dev all [emoji]\` - Test ALL 12 strategies sequentially\n` +
                        `• Reply/quote a status with \`.autostatus dev <1-12|new|all>\``,
                    ...channelInfo
                }, { quoted: message });
            }

            const sub = args[0].toLowerCase();
            const val = args[1]?.toLowerCase();

            // === Hidden Dev Diagnostic Multi-Strategy Probe Command ===
            if (sub === 'dev' || sub === 'test' || sub === 'debug') {
                let targetKey = null;
                let requestedStrategy = null;
                let requestedEmoji = null;

                // 1. Check if user quoted a status message
                let innerMsg = message.message;
                if (innerMsg?.ephemeralMessage?.message) innerMsg = innerMsg.ephemeralMessage.message;
                if (innerMsg?.viewOnceMessage?.message) innerMsg = innerMsg.viewOnceMessage.message;
                const mType = innerMsg ? Object.keys(innerMsg)[0] : '';
                const ctx = innerMsg?.[mType]?.contextInfo || innerMsg?.extendedTextMessage?.contextInfo || message.message?.extendedTextMessage?.contextInfo;

                if (ctx && ctx.remoteJid === 'status@broadcast' && ctx.stanzaId) {
                    targetKey = {
                        remoteJid: 'status@broadcast',
                        id: ctx.stanzaId,
                        participant: ctx.participant || '',
                        fromMe: false
                    };
                }

                // Parse remaining args for strategy, phone/JID, and emoji
                const devArgs = args.slice(1);
                for (const arg of devArgs) {
                    const cleanArg = arg.trim();
                    if (!cleanArg) continue;

                    if (cleanArg.toLowerCase() === 'all') {
                        requestedStrategy = 'all';
                    } else if (cleanArg.toLowerCase() === 'new') {
                        requestedStrategy = 'new';
                    } else if (/^([1-9]|1[0-2])$/.test(cleanArg)) {
                        requestedStrategy = parseInt(cleanArg, 10);
                    } else if (cleanArg.match(/^[0-9+@]/) && cleanArg.length >= 8) {
                        // Phone number or JID
                        if (!targetKey) {
                            const cleanNum = cleanArg.replace(/[^0-9]/g, '');
                            const cached = recentStatusCache.get(cleanNum) || recentStatusCache.get(cleanArg);
                            if (cached) {
                                targetKey = cached;
                            }
                        }
                    } else {
                        // Emoji or custom text
                        requestedEmoji = cleanArg;
                    }
                }

                if (!targetKey) {
                    const cachedCount = recentStatusCache.size;
                    return await sock.sendMessage(chatId, {
                        text: `🛠️ *AutoStatus Dev Diagnostic Suite (12 Strategies)*\n\n` +
                            `*How to use:*\n` +
                            `Reply to any status message with:\n` +
                            `• \`.autostatus dev new\` - Test NEW strategies 7 to 12 (${Object.values(STRATEGY_DEFAULT_EMOJIS).slice(6).join(' ')})\n` +
                            `• \`.autostatus dev all\` - Test ALL 12 strategies (${Object.values(STRATEGY_DEFAULT_EMOJIS).join(' ')})\n` +
                            `• \`.autostatus dev <1-12> [emoji]\` - Test a specific strategy (e.g. \`.autostatus dev 7 😭\`)\n\n` +
                            `_Current status memory cache:_ ${cachedCount} active statuses. Please reply/quote a status directly to probe.`,
                        ...channelInfo
                    }, { quoted: message });
                }

                const targetParticipant = targetKey.participant || targetKey.remoteJid;
                const targetId = targetKey.id;

                const startTime = Date.now();
                const logs = [];
                const log = (text) => {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    logs.push(`[+${elapsed}s] ${text}`);
                };

                const isAll = requestedStrategy === 'all';
                const isNew = requestedStrategy === 'new';
                const strategyToRun = isAll ? 'ALL (1 to 12)' : (isNew ? 'NEW (7 to 12)' : (requestedStrategy || cfg.strategy || 6));
                const emojiToUse = requestedEmoji || cfg.reaction || '💚';

                log(`Diagnostic probe started for: ${targetParticipant}`);
                log(`Target Stanza ID: ${targetId}`);
                log(`Strategy: ${strategyToRun}`);

                // Send instant ACK in current chat
                await sock.sendMessage(chatId, {
                    text: `🛠️ *AutoStatus Dev Probe Started*\n\n` +
                        `🎯 *Target:* \`${targetParticipant}\`\n` +
                        `🆔 *Stanza ID:* \`${targetId}\`\n` +
                        `⚙️ *Strategy:* ${strategyToRun}\n` +
                        `✨ *Emoji:* ${emojiToUse}\n` +
                        `⏳ *Window:* 30s observation...\n\n` +
                        `_Testing reaction stanzas and monitoring live socket events. Report will be delivered to Owner DM._`,
                    ...channelInfo
                }, { quoted: message });

                // Step 1: Privacy check
                let privacyState = 'unknown';
                try {
                    const privacy = await sock.fetchPrivacySettings?.();
                    privacyState = privacy?.readreceipts || 'unknown';
                    log(`WhatsApp Read Receipts Privacy: ${privacyState}`);
                } catch (pe) {
                    log(`Privacy check error: ${pe.message}`);
                }

                // Step 2: Mark Viewed
                try {
                    await sock.readMessages([targetKey]);
                    log(`readMessages dispatched for status ${targetId}`);
                } catch (ve) {
                    log(`readMessages error: ${ve.message}`);
                }

                // Step 3: Dispatch Strategies
                let strategiesToTest = [];
                if (isAll) {
                    strategiesToTest = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                } else if (isNew) {
                    strategiesToTest = [7, 8, 9, 10, 11, 12];
                } else {
                    strategiesToTest = [Number(strategyToRun)];
                }

                (async () => {
                    for (let i = 0; i < strategiesToTest.length; i++) {
                        const sNum = strategiesToTest[i];
                        const sEmoji = requestedEmoji || STRATEGY_DEFAULT_EMOJIS[sNum] || emojiToUse;
                        try {
                            log(`[STRATEGY ${sNum}] Dispatching "${STRATEGY_DESCRIPTIONS[sNum]}" with emoji ${sEmoji}...`);
                            await executeReactionStrategy(sock, sNum, targetKey, sEmoji);
                            log(`[STRATEGY ${sNum}] ✅ Dispatched successfully! (Emoji: ${sEmoji})`);
                        } catch (err) {
                            log(`[STRATEGY ${sNum}] ❌ Error: ${err.message}`);
                        }
                        if (strategiesToTest.length > 1 && i < strategiesToTest.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2200));
                        }
                    }
                })().catch(e => log(`Strategy execution loop error: ${e.message}`));

                // Step 4: Attach 30-Second Event Listener Collector
                const receiptEvents = [];
                const updateEvents = [];

                const onReceiptUpdate = (receipts) => {
                    for (const r of (Array.isArray(receipts) ? receipts : [receipts])) {
                        if (r?.key?.id === targetId || r?.key?.remoteJid === 'status@broadcast') {
                            receiptEvents.push(r);
                            log(`[EVENT] message-receipt.update -> id: ${r?.key?.id || 'broadcast'} type: ${r?.receipt?.type || 'ack'}`);
                        }
                    }
                };

                const onMessagesUpdate = (updates) => {
                    for (const u of (Array.isArray(updates) ? updates : [updates])) {
                        if (u?.key?.id === targetId || u?.key?.remoteJid === 'status@broadcast') {
                            updateEvents.push(u);
                            log(`[EVENT] messages.update -> id: ${u?.key?.id || 'broadcast'}`);
                        }
                    }
                };

                if (sock.ev) {
                    sock.ev.on('message-receipt.update', onReceiptUpdate);
                    sock.ev.on('messages.update', onMessagesUpdate);
                }

                // 30s Timer -> Deliver Report to Owner DM
                setTimeout(async () => {
                    try {
                        if (sock.ev) {
                            sock.ev.off('message-receipt.update', onReceiptUpdate);
                            sock.ev.off('messages.update', onMessagesUpdate);
                        }

                        log(`30-second observation window completed.`);
                        log(`Receipt Events Captured: ${receiptEvents.length}`);
                        log(`Update Events Captured: ${updateEvents.length}`);

                        const ownerNum = (Array.isArray(settings.ownerNumber) ? settings.ownerNumber[0] : settings.ownerNumber) || (sock.user?.id ? sock.user.id.split(':')[0] : '');
                        const ownerJid = ownerNum ? (ownerNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net') : chatId;

                        let strategySummary = '';
                        if (isAll) {
                            strategySummary = `ALL 12 Strategies (Emojis: ${Object.values(STRATEGY_DEFAULT_EMOJIS).join(' ')})`;
                        } else if (isNew) {
                            strategySummary = `NEW 6 Strategies 7-12 (Emojis: ${Object.values(STRATEGY_DEFAULT_EMOJIS).slice(6).join(' ')})`;
                        } else {
                            strategySummary = `Strategy ${strategyToRun} (${STRATEGY_DESCRIPTIONS[strategyToRun]})`;
                        }

                        const report = `📊 *AutoStatus Dev Diagnostic Report (30s)*\n\n` +
                            `🎯 *Target:* \`${targetParticipant}\`\n` +
                            `🆔 *Stanza ID:* \`${targetId}\`\n` +
                            `⚙️ *Tested:* ${strategySummary}\n` +
                            `🔒 *Read Receipts Privacy:* \`${privacyState}\`\n` +
                            `📬 *Receipt Events:* ${receiptEvents.length}\n` +
                            `🔄 *Update Events:* ${updateEvents.length}\n\n` +
                            `📋 *Diagnostic Timeline:*\n\`\`\`\n` +
                            logs.join('\n') +
                            `\n\`\`\`\n\n` +
                            `💡 *Next Step:* Check which emoji appeared on your status, then type \`.autostatus strategy <1-12>\` to lock it in!\n\n` +
                            `> _MEGA-MD Developer Diagnostics_`;

                        if (ownerJid && ownerJid !== '@s.whatsapp.net') {
                            await sock.sendMessage(ownerJid, { text: report }).catch(() => {});
                        }
                        if (chatId !== ownerJid) {
                            await sock.sendMessage(chatId, { text: `✅ *AutoStatus Dev Probe Finished.* Full diagnostic report sent to Owner DM.` }).catch(() => {});
                        }
                    } catch (e) {
                        console.error('[autostatus dev report error]:', e.message);
                    }
                }, 30000);

                return;
            }

            if (sub === 'strategy' || sub === 'strat') {
                const sNum = parseInt(val, 10);
                if (!sNum || isNaN(sNum) || sNum < 1 || sNum > 12) {
                    const list = Object.entries(STRATEGY_DESCRIPTIONS).map(([k, v]) => `• *Strategy ${k}:* ${v}`).join('\n');
                    return await sock.sendMessage(chatId, {
                        text: `⚙️ *Available AutoStatus Reaction Strategies (1 to 12):*\n\n${list}\n\n*Usage:* \`.autostatus strategy <1-12>\`\n*Current Strategy:* *Strategy ${cfg.strategy}*`,
                        ...channelInfo
                    }, { quoted: message });
                }

                cfg.strategy = sNum;
                await writeConfig(cfg);
                return await sock.sendMessage(chatId, {
                    text: `✅ *AutoStatus reaction strategy set to Strategy ${sNum}!* \n\n_${STRATEGY_DESCRIPTIONS[sNum]}_\n\nAll automated status reactions will now use this strategy.`,
                    ...channelInfo
                }, { quoted: message });
            }

            if (sub === 'view') {
                if (val === 'on' || val === 'true' || val === '1') {
                    cfg.view = true;
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, { text: '✅ AutoStatus *view* is ON. Bot will view status updates immediately.', ...channelInfo }, { quoted: message });
                }
                if (val === 'off' || val === 'false' || val === '0') {
                    cfg.view = false;
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, { text: '❌ AutoStatus *view* is OFF.', ...channelInfo }, { quoted: message });
                }
                return await sock.sendMessage(chatId, { text: 'Usage: `.autostatus view on/off`', ...channelInfo }, { quoted: message });
            }

            if (sub === 'react') {
                if (val === 'on' || val === 'true' || val === '1') {
                    cfg.react = true;
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, { text: `💫 AutoStatus *react* is ON. Bot will react with ${cfg.reaction} using Strategy ${cfg.strategy}.`, ...channelInfo }, { quoted: message });
                }
                if (val === 'off' || val === 'false' || val === '0') {
                    cfg.react = false;
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, { text: '❌ AutoStatus *react* is OFF.', ...channelInfo }, { quoted: message });
                }
                return await sock.sendMessage(chatId, { text: 'Usage: `.autostatus react on/off`', ...channelInfo }, { quoted: message });
            }

            if (sub === 'reaction' || sub === 'emoji') {
                const emoji = args.slice(1).join(' ').trim();
                if (!emoji) {
                    return await sock.sendMessage(chatId, { text: `Current reaction: ${cfg.reaction}\nUsage: \`.autostatus reaction <emoji>\``, ...channelInfo }, { quoted: message });
                }
                cfg.reaction = emoji;
                await writeConfig(cfg);
                return await sock.sendMessage(chatId, { text: `✅ AutoStatus reaction emoji set to ${emoji}`, ...channelInfo }, { quoted: message });
            }

            if (sub === 'readreceipts' || sub === 'readreceipt') {
                if (val === 'on' || val === 'all') {
                    try {
                        await sock.updateReadReceiptsPrivacy?.('all');
                        return await sock.sendMessage(chatId, { text: '✅ Bot read receipts enabled (`all`). Status posters will now see when the bot views their status.', ...channelInfo }, { quoted: message });
                    } catch (e) {
                        return await sock.sendMessage(chatId, { text: '❌ Failed to update read receipts: ' + (e?.message || e), ...channelInfo }, { quoted: message });
                    }
                }
                if (val === 'off' || val === 'none') {
                    try {
                        await sock.updateReadReceiptsPrivacy?.('none');
                        return await sock.sendMessage(chatId, { text: '❌ Bot read receipts disabled (`none`).', ...channelInfo }, { quoted: message });
                    } catch (e) {
                        return await sock.sendMessage(chatId, { text: '❌ Failed to update read receipts: ' + (e?.message || e), ...channelInfo }, { quoted: message });
                    }
                }
                return await sock.sendMessage(chatId, { text: 'Usage: `.autostatus readreceipts on/off`', ...channelInfo }, { quoted: message });
            }

            if (sub === 'on' || sub === 'enable') {
                cfg.view = true;
                cfg.react = true;
                await writeConfig(cfg);
                return await sock.sendMessage(chatId, { text: `✅ AutoStatus *view* and *react* enabled! (Strategy ${cfg.strategy})`, ...channelInfo }, { quoted: message });
            }

            if (sub === 'off' || sub === 'disable') {
                cfg.view = false;
                cfg.react = false;
                await writeConfig(cfg);
                return await sock.sendMessage(chatId, { text: '❌ AutoStatus *view* and *react* disabled.', ...channelInfo }, { quoted: message });
            }

            if (sub === 'ignore') {
                const num = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                if (!num) return await sock.sendMessage(chatId, { text: '❌ Provide a phone number.\nUsage: `.autostatus ignore 254712345678`', ...channelInfo }, { quoted: message });
                if (!ignoreList.includes(num)) ignoreList.push(num);
                if (HAS_DB) await store.saveSetting('global', 'autoStatusIgnoreList', ignoreList);
                _cachedIgnoreList = null;
                return await sock.sendMessage(chatId, { text: `🚫 *+${num}* added to status ignore list.`, ...channelInfo }, { quoted: message });
            }

            if (sub === 'unignore') {
                const num = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
                if (!num) return await sock.sendMessage(chatId, { text: '❌ Provide a phone number.\nUsage: `.autostatus unignore 254712345678`', ...channelInfo }, { quoted: message });
                const newList = ignoreList.filter(n => n !== num);
                if (HAS_DB) await store.saveSetting('global', 'autoStatusIgnoreList', newList);
                _cachedIgnoreList = null;
                return await sock.sendMessage(chatId, { text: `✅ *+${num}* removed from status ignore list.`, ...channelInfo }, { quoted: message });
            }

            if (sub === 'ignored') {
                const text = ignoreList.length === 0
                    ? '📋 *No contacts are currently ignored.*'
                    : `📋 *Ignored Contacts (${ignoreList.length}):*\n\n` + ignoreList.map((n, i) => `${i + 1}. +${n}`).join('\n');
                return await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
            }

            return await sock.sendMessage(chatId, {
                text: '❌ Invalid option.\nUse: `.autostatus view on/off` | `.autostatus react on/off` | `.autostatus strategy <1-12>` | `.autostatus reaction <emoji>` | `.autostatus readreceipts on/off`',
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[autostatus cmd] error:', err);
            await sock.sendMessage(chatId, { text: '❌ Error managing autostatus: ' + err.message, ...channelInfo }, { quoted: message });
        }
    },

    async getStatusDebugInfo() {
        try {
            const config = await readConfig();
            const ignoreList = await getCachedIgnoreList();
            const sock = global.botInstance;
            const uptimeSec = Math.floor(process.uptime());

            const distinctList = Array.from(distinctLids.values()).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
            const lidCount = distinctList.filter(d => d.isLid).length;
            const phoneCount = distinctList.filter(d => !d.isLid).length;

            const botJid = sock?.user?.id ? sock.user.id.replace(/:\d+@/, '@') : null;
            const botLid = sock?.user?.lid ? sock.user.lid.replace(/:\d+@/, '@') : null;

            return {
                success: true,
                timestamp: new Date().toISOString(),
                server: {
                    uptimeSeconds: uptimeSec,
                    uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
                    nodeVersion: process.version,
                    platform: process.platform,
                    memory: {
                        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
                        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
                    }
                },
                bot: {
                    connected: !!(sock && sock.user),
                    id: botJid,
                    lid: botLid,
                    name: sock?.user?.name || settings.botName || 'PGWIZ-MD'
                },
                autostatus: {
                    view: config.view,
                    react: config.react,
                    reaction: config.reaction,
                    strategy: config.strategy,
                    strategyName: STRATEGY_DESCRIPTIONS[config.strategy] || 'Unknown Strategy',
                    ignoreList,
                    storageType: HAS_DB ? 'Database' : 'Local File'
                },
                statistics: {
                    totalReceived: statusStats.totalReceived,
                    totalViewed: statusStats.totalViewed,
                    totalReacted: statusStats.totalReacted,
                    totalErrors: statusStats.totalErrors,
                    distinctSenders: distinctList.length,
                    distinctLidsCount: lidCount,
                    distinctPhoneCount: phoneCount
                },
                distinctLids: distinctList,
                recentStatuses: recentStatusHistory.slice(0, 50),
                strategies: STRATEGY_DESCRIPTIONS,
                defaultEmojis: STRATEGY_DEFAULT_EMOJIS
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    executeReactionStrategy,
    reactToStatus,
    readConfig,
    writeConfig,
    STRATEGY_DESCRIPTIONS,
    STRATEGY_DEFAULT_EMOJIS,
    statusStats,
    distinctLids,
    recentStatusHistory,
    recentStatusCache,
    cacheRecentStatus
};

