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
    1: 'Pure Broadcast Relay (GlobalTech & Fortunatus Standard)',
    2: 'Fresh ID Broadcast Relay (Multi-Device List)',
    3: 'Broadcast Relay (Direct Target List)',
    4: 'Native Broadcast React (sendMessage to status@broadcast)',
    5: 'Normalized Phone Broadcast Relay',
    6: 'Broadcast Relay (Multi-Identifier with senderTimestampMs)',
    7: 'Broadcast Relay (groupingKey & senderTimestampMs)',
    8: 'Broadcast Relay (participantPn Prioritized)',
    9: 'Broadcast Relay (Simplified Payload)',
    10: 'Multi-Vector Broadcast Combo (Relay + Native Broadcast)',
    11: 'Direct LID Broadcast Relay (statusJidList author LID)',
    12: 'Direct LID Native Broadcast React (to status@broadcast)'
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

// Unicode test regex covering:
// 1. Regional Indicator Pairs (flags like 🇺🇸, 🇰🇪)
// 2. Keycaps ([0-9#*]\uFE0F?\u20E3 or 🔟)
// 3. Extended Pictographic & Emoji Presentation characters with skin tones, variation selectors, and ZWJ combinations
// 4. Common symbol emojis like ™️, ©️, ®️, ‼️, ⁉️, 〽️
const EMOJI_TEST_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|[\uFE0F\u20E3])/u;
const FULL_EMOJI_REGEX = /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\uD83D\uDD1F|[\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*)/gu;

function parseEmojiList(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
        const out = [];
        for (const item of input) {
            out.push(...parseEmojiList(item));
        }
        return out;
    }
    let str = String(input).trim();
    if (!str) return [];

    const lower = str.toLowerCase();
    if (lower === 'random' || lower === 'none' || lower === 'false' || lower === 'off' || lower === 'disabled' || lower === 'null' || lower === 'undefined') {
        return [];
    }

    // Strip wrapping quotes if any
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
    }

    // JSON array
    if (str.startsWith('[') && str.endsWith(']')) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parseEmojiList(parsed);
            }
        } catch (_) {
            try {
                const parsed = JSON.parse(str.replace(/'/g, '"'));
                if (Array.isArray(parsed)) {
                    return parseEmojiList(parsed);
                }
            } catch (_) {}
        }
    }

    // Delimited formats (comma, semicolon, pipe, slash, whitespace)
    if (/[,;|/\s]+/.test(str)) {
        const parts = str
            .split(/[,;|/\s]+/)
            .map(s => s.trim())
            .filter(Boolean);
        const result = [];
        for (const p of parts) {
            if (EMOJI_TEST_REGEX.test(p)) {
                if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                    const clusters = Array.from(seg.segment(p), s => s.segment.trim()).filter(s => s && EMOJI_TEST_REGEX.test(s));
                    result.push(...clusters);
                } else {
                    result.push(p);
                }
            }
        }
        if (result.length > 0) return result;
    }

    // Grapheme cluster segmentation (contiguous emojis "❤️🔥✨💯" or single emoji "💯", "🇺🇸", "1️⃣")
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(str), s => s.segment.trim())
                .filter(s => s && EMOJI_TEST_REGEX.test(s));
            if (segments.length > 0) return segments;
        } catch (_) {}
    }

    // Fallback regex match
    const matches = str.match(FULL_EMOJI_REGEX);
    if (matches && matches.length > 0) {
        return matches.map(s => s.trim()).filter(Boolean);
    }

    return [];
}

const HARDCODED_FALLBACK_EMOJIS = ['❤️', '🔥', '✨', '💯', '🌟', '⚡', '😍', '👏', '💖', '🥰', '👍', '🎉'];

function getEnvStatusEmojis() {
    const raw = (process.env.AUTO_STATUS_EMOJIS && process.env.AUTO_STATUS_EMOJIS.trim()) ||
                (process.env.STATUS_EMOJIS && process.env.STATUS_EMOJIS.trim()) ||
                (process.env.AUTO_REACT_STATUS_EMOJIS && process.env.AUTO_REACT_STATUS_EMOJIS.trim()) ||
                (process.env.STATUS_REACTION_EMOJIS && process.env.STATUS_REACTION_EMOJIS.trim()) ||
                (process.env.AUTO_STATUS_EMOJI && process.env.AUTO_STATUS_EMOJI.trim()) ||
                (process.env.STATUS_EMOJI && process.env.STATUS_EMOJI.trim()) ||
                (settings?.statusEmojis && settings.statusEmojis.trim());
    return parseEmojiList(raw);
}

function getEnvStatusReaction() {
    return (
        (process.env.AUTO_STATUS_REACTION && process.env.AUTO_STATUS_REACTION.trim()) ||
        (process.env.STATUS_REACTION && process.env.STATUS_REACTION.trim()) ||
        (process.env.AUTO_STATUS_EMOJI && process.env.AUTO_STATUS_EMOJI.trim()) ||
        (process.env.STATUS_EMOJI && process.env.STATUS_EMOJI.trim()) ||
        (settings?.statusReaction && settings.statusReaction.trim()) ||
        ''
    );
}

function resolveDefaultReaction() {
    const envReaction = getEnvStatusReaction();
    if (envReaction) {
        if (envReaction.toLowerCase() === 'random') return 'random';
        const parsed = parseEmojiList(envReaction);
        if (parsed.length > 1) return 'random';
        if (parsed.length === 1) return parsed[0];
        return envReaction;
    }
    const envEmojis = getEnvStatusEmojis();
    if (envEmojis.length > 1) return 'random';
    if (envEmojis.length === 1) return envEmojis[0];
    return '💯';
}

const DEFAULTS = {
    view: true,
    react: true,
    reaction: resolveDefaultReaction(),
    strategy: 1,
    emojis: getEnvStatusEmojis().length > 0 ? getEnvStatusEmojis() : HARDCODED_FALLBACK_EMOJIS
};

if (!HAS_DB && !fs.existsSync(configPath)) {
    try {
        if (!fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2));
    } catch {}
}

const { channelInfo } = require('../lib/messageConfig');

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

        const envReactionRaw = getEnvStatusReaction();
        const envEmojisList = getEnvStatusEmojis();

        // 1. Emoji pool: Env has absolute priority over DB/file
        let effectiveEmojis = DEFAULTS.emojis;
        if (envEmojisList.length > 0) {
            effectiveEmojis = envEmojisList;
        } else if (envReactionRaw) {
            const parsedReaction = parseEmojiList(envReactionRaw);
            if (parsedReaction.length > 1) {
                effectiveEmojis = parsedReaction;
            }
        } else if (Array.isArray(data.emojis) && data.emojis.length > 0) {
            const parsedStored = parseEmojiList(data.emojis);
            if (parsedStored.length > 0) effectiveEmojis = parsedStored;
        } else if (typeof data.emojis === 'string' && data.emojis.trim()) {
            const parsedStored = parseEmojiList(data.emojis);
            if (parsedStored.length > 0) effectiveEmojis = parsedStored;
        }

        // 2. Reaction emoji / mode: Env has absolute priority
        let effectiveReaction = DEFAULTS.reaction;
        if (envReactionRaw) {
            if (envReactionRaw.toLowerCase() === 'random') {
                effectiveReaction = 'random';
            } else {
                const parsed = parseEmojiList(envReactionRaw);
                effectiveReaction = parsed.length > 1 ? 'random' : (parsed[0] || envReactionRaw);
            }
        } else if (envEmojisList.length > 1) {
            // When user specifies multiple emojis in env and no fixed reaction emoji, randomize
            effectiveReaction = 'random';
        } else if (envEmojisList.length === 1) {
            effectiveReaction = envEmojisList[0];
        } else if (data.reaction) {
            effectiveReaction = data.reaction;
        }

        let activeStrategy = 1;
        if (hasEnvStrategy) {
            activeStrategy = parseInt(envStrategyRaw, 10);
        } else if (data.strategy !== undefined && data.strategy !== null) {
            activeStrategy = Number(data.strategy);
        }

        _cachedConfig = {
            view: hasEnvView ? parseEnvBool(envViewRaw, true) : (data.view !== undefined ? parseEnvBool(data.view, true) : (data.enabled !== undefined ? parseEnvBool(data.enabled, true) : true)),
            react: hasEnvReact ? parseEnvBool(envReactRaw, true) : (data.react !== undefined ? parseEnvBool(data.react, true) : (data.reactOn !== undefined ? parseEnvBool(data.reactOn, true) : true)),
            reaction: effectiveReaction,
            strategy: activeStrategy,
            emojis: effectiveEmojis
        };
        _cachedConfigTime = now;
        return _cachedConfig;
    } catch (e) {
        return { ...DEFAULTS };
    }
}

function invalidateConfigCache() {
    _cachedConfig = null;
    _cachedConfigTime = 0;
    _cachedIgnoreList = null;
    _cachedIgnoreTime = 0;
}

async function writeConfig(config) {
    try {
        invalidateConfigCache();

        if (config.view !== undefined) process.env.AUTO_STATUS_VIEW = String(config.view);
        if (config.react !== undefined) process.env.AUTO_STATUS_REACT = String(config.react);
        if (config.strategy !== undefined) process.env.AUTO_STATUS_STRATEGY = String(config.strategy);
        if (config.reaction !== undefined) {
            process.env.AUTO_STATUS_REACTION = String(config.reaction);
            process.env.STATUS_REACTION = String(config.reaction);
        }
        if (config.emojis !== undefined) {
            const emList = Array.isArray(config.emojis) ? config.emojis : parseEmojiList(config.emojis);
            const emStr = emList.join(',');
            process.env.AUTO_STATUS_EMOJIS = emStr;
            process.env.STATUS_EMOJIS = emStr;
        }

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

function getStatusEmoji(cfg = {}) {
    const envReactionRaw = getEnvStatusReaction();
    const envEmojisList = getEnvStatusEmojis();

    // 1. Single or list reaction emoji explicitly set in env
    if (envReactionRaw) {
        if (envReactionRaw.toLowerCase() === 'random') {
            const pool = envEmojisList.length > 0 ? envEmojisList : ((Array.isArray(cfg?.emojis) && cfg.emojis.length > 0) ? cfg.emojis : DEFAULTS.emojis);
            return pool[Math.floor(Math.random() * pool.length)];
        }
        const parsed = parseEmojiList(envReactionRaw);
        if (parsed.length === 1) {
            return parsed[0];
        }
        if (parsed.length > 1) {
            return parsed[Math.floor(Math.random() * parsed.length)];
        }
        return envReactionRaw;
    }

    // 2. Emoji pool set in env (e.g. AUTO_STATUS_EMOJIS or STATUS_EMOJIS) -> pick randomly
    if (envEmojisList.length > 1) {
        return envEmojisList[Math.floor(Math.random() * envEmojisList.length)];
    }
    if (envEmojisList.length === 1) {
        return envEmojisList[0];
    }

    // 3. Fallback to cfg.reaction if set and not 'random'
    const confReaction = cfg?.reaction || DEFAULTS.reaction;
    if (confReaction) {
        if (String(confReaction).toLowerCase() === 'random') {
            const pool = (Array.isArray(cfg?.emojis) && cfg.emojis.length > 0) ? cfg.emojis : DEFAULTS.emojis;
            return pool[Math.floor(Math.random() * pool.length)];
        }
        const parsed = parseEmojiList(confReaction);
        if (parsed.length === 1) {
            return parsed[0];
        }
        if (parsed.length > 1) {
            return parsed[Math.floor(Math.random() * parsed.length)];
        }
    }

    // 4. Config emoji pool
    if (Array.isArray(cfg?.emojis) && cfg.emojis.length > 0) {
        return cfg.emojis[Math.floor(Math.random() * cfg.emojis.length)];
    }

    return DEFAULTS.emojis[0] || '❤️';
}

// Track reacted statuses to prevent duplicate reaction stanzas
const reactedStatusKeys = new Set();
setInterval(() => {
    if (reactedStatusKeys.size > 2000) reactedStatusKeys.clear();
}, 60000).unref();

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

    // Dynamic resolution for @lid participants via Baileys Signal repo or known defaults
    if (!phoneJid && isLid) {
        try {
            const mappedPn = sock.signalRepository?.lidMapping?.getPNForLID ? await sock.signalRepository.lidMapping.getPNForLID(rawParticipant) : null;
            if (mappedPn && mappedPn.includes('@s.whatsapp.net')) {
                phoneJid = mappedPn;
            }
        } catch {}
        if (!phoneJid) {
            const rawDigits = rawParticipant.split('@')[0];
            if (rawDigits === '62561080893516') {
                phoneJid = '254789462334@s.whatsapp.net';
            }
        }
        if (phoneJid && global.lidJidMap) {
            global.lidJidMap.set(rawParticipant, phoneJid);
        }
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

    switch (Number(strategyNum)) {
        case 1: {
            // Strategy 1: Pure Broadcast Relay (GlobalTech & Fortunatus Standard)
            // Relays reactionMessage directly to status@broadcast with exact status key.
            // Avoids sock.sendMessage's client-side pairwise Signal session checks that cause "No sessions" on stranger LIDs.
            const phoneTarget = statusKey.participantPn || phoneJid;
            const targets = Array.from(new Set([rawParticipant, phoneTarget])).filter(j => j && j !== 'status@broadcast');
            const statusJidList = targets.length > 0 ? targets : [rawParticipant];

            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: rawParticipant,
                        fromMe: false
                    },
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {                statusJidList
            });
        }
        case 2: {
            // Strategy 2: Fresh generated Message ID Relay to status@broadcast
            const targets = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            const statusJidList = targets.length > 0 ? targets : [rawParticipant];
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {
                statusJidList
            });
        }
        case 3: {
            // Strategy 3: Broadcast Relay with direct target list
            const statusJidList = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji
                }
            }, {
                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 4: {
            // Strategy 4: Native Broadcast React (sendMessage directly to status@broadcast)
            const targets = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            const statusJidList = targets.length > 0 ? targets : [rawParticipant];
            return await sock.sendMessage('status@broadcast', {
                react: {
                    text: emoji,
                    key: reactionKey
                }
            }, {
                statusJidList
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
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 6: {
            // Strategy 6: Broadcast Relay with senderTimestampMs
            const targets = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            const statusJidList = targets.length > 0 ? targets : [rawParticipant];
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {
                statusJidList
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
            }, {                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 8: {
            // Strategy 8: Broadcast Relay with participantPn prioritization
            const target = (statusKey.participantPn && statusKey.participantPn.includes('@s.whatsapp.net'))
                ? statusKey.participantPn
                : (phoneJid || rawParticipant);
            const statusJidList = [target, rawParticipant].filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {                statusJidList: statusJidList.length > 0 ? statusJidList : [rawParticipant]
            });
        }
        case 9: {
            // Strategy 9: Broadcast Relay with simplified payload
            const targets = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: rawParticipant,
                        fromMe: false
                    },
                    text: emoji
                }
            }, {                statusJidList: targets.length > 0 ? targets : [rawParticipant]
            });
        }
        case 10: {
            // Strategy 10: Multi-Vector Resilient Broadcast Combo (Relay to status@broadcast + Native react to status@broadcast)
            const targets = Array.from(new Set([rawParticipant, phoneJid])).filter(j => j && j !== 'status@broadcast');
            const statusJidList = targets.length > 0 ? targets : [rawParticipant];

            const promises = [];
            // Vector 1: Standard Broadcast Relay to status@broadcast
            promises.push(
                sock.relayMessage('status@broadcast', {
                    reactionMessage: {
                        key: reactionKey,
                        text: emoji,
                        senderTimestampMs: nowMs
                    }
                }, {                    statusJidList
                }).catch(() => {})
            );

            // Vector 2: Native Broadcast React to status@broadcast
            promises.push(
                sock.sendMessage('status@broadcast', {
                    react: {
                        text: emoji,
                        key: reactionKey
                    }
                }, {
                    statusJidList
                }).catch(() => {})
            );

            await Promise.allSettled(promises);
            return true;
        }
        case 11: {
            // Strategy 11: Broadcast Relay targeting author LID explicitly in statusJidList
            const statusJidList = [rawParticipant].filter(j => j && j !== 'status@broadcast');
            return await sock.relayMessage('status@broadcast', {
                reactionMessage: {
                    key: reactionKey,
                    text: emoji,
                    senderTimestampMs: nowMs
                }
            }, {                statusJidList
            });
        }
        case 12: {
            // Strategy 12: Native Broadcast React targeting author LID explicitly
            return await sock.sendMessage('status@broadcast', {
                react: {
                    text: emoji,
                    key: reactionKey
                }
            }, {
                statusJidList: [rawParticipant]
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
        const strat = Number(customStrategy) || Number(cfg.strategy) || 1;

        try {
            await executeReactionStrategy(sock, strat, statusKey, emoji);
        } catch (stratErr) {
            // Graceful fallback to pure broadcast relay (Strategy 1) if chosen strategy hit errors
            if (strat !== 1) {
                await executeReactionStrategy(sock, 1, statusKey, emoji);
            } else {
                throw stratErr;
            }
        }

        if (process.env.VERBOSE_LOGS === 'true' || process.env.DEBUG === 'true') {
            console.log(`[AUTOSTATUS] ✅ Reacted to status ${statusKey.id} from ${statusKey.participant || 'contact'} with ${emoji} (Strategy ${strat})`);
        }
        return true;
    } catch (error) {
        if (process.env.VERBOSE_LOGS === 'true' || process.env.DEBUG === 'true') {
            console.error(`[AUTOSTATUS] ⚠️ Reaction skipped for ${statusKey.id}:`, error.message);
        }
        return false;
    }
}

/**
 * Status content filters
 * - CIPHERTEXT placeholders (first status from a contact usually arrives undecryptable with
 *   'No SenderKeyRecord'); Baileys sends a retry receipt and re-emits the decrypted copy on
 *   messages.upsert with the SAME key.id. We pre-warm sessions immediately and wait briefly
 *   for that copy; if it never arrives we react using the placeholder key.
 * - Deletes (protocolMessage REVOKE), sender-key-only packets, reactions and own statuses are skipped.
 */
const inFlightStatusKeys = new Set();
const pendingStubStatuses = new Map(); // msgId -> timeout handle
const revokedStatusIds = new Set();
const STATUS_MAX_AGE_SEC = 24 * 60 * 60;
const STUB_FALLBACK_MS = 6000;
const NON_CONTENT_KEYS = new Set([
    'senderKeyDistributionMessage', 'messageContextInfo', 'protocolMessage',
    'reactionMessage', 'encReactionMessage', 'pollUpdateMessage', 'keepInChatMessage',
    'pinInChatMessage', 'editedMessage'
]);

function unwrapStatusMessage(m) {
    let msg = m;
    for (let i = 0; i < 5 && msg; i++) {
        const inner = msg.ephemeralMessage?.message || msg.viewOnceMessage?.message ||
            msg.viewOnceMessageV2?.message || msg.viewOnceMessageV2Extension?.message ||
            msg.documentWithCaptionMessage?.message;
        if (!inner) break;
        msg = inner;
    }
    return msg;
}

function statusMsgId(key) {
    return `${key.participant || ''}:${key.id}`;
}

function getStatusTimestamp(msg) {
    const t = msg?.messageTimestamp;
    if (!t) return 0;
    if (typeof t === 'object') return Number(t.low ?? t.toNumber?.() ?? 0);
    return Number(t);
}

function getStatusSkipReason(msg, sock) {
    const key = msg?.key;
    if (!key || key.remoteJid !== 'status@broadcast') return 'not-status';
    if (key.fromMe) return 'own';
    const p = (key.participant || '').replace(/:\d+@/, '@');
    const me = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(j => j.replace(/:\d+@/, '@'));
    if (p && me.includes(p)) return 'own-lid';
    const ts = getStatusTimestamp(msg);
    if (ts && (Date.now() / 1000 - ts) > STATUS_MAX_AGE_SEC) return 'stale';
    if (revokedStatusIds.has(key.id)) return 'revoked';
    if (msg.messageStubType) return msg.messageStubType === 2 ? 'ciphertext' : `stub:${msg.messageStubType}`;
    const content = unwrapStatusMessage(msg.message);
    if (!content || typeof content !== 'object') return 'ciphertext';
    if (content.protocolMessage) return 'protocol/revoke';
    const types = Object.keys(content).filter(k => !NON_CONTENT_KEYS.has(k));
    if (types.length === 0) return 'no-content';
    return null;
}

function clearPendingStub(msgId) {
    const t = pendingStubStatuses.get(msgId);
    if (t) {
        clearTimeout(t);
        pendingStubStatuses.delete(msgId);
    }
}

/**
 * Pre-warm device list + Signal sessions for a status author so the reaction relay
 * does not have to do USync + prekey round-trips (the cause of slow / failed first reactions).
 */
const _prewarmedAuthors = new Map();
async function prewarmStatusAuthor(sock, authorJid) {
    try {
        if (!authorJid || authorJid === 'status@broadcast') return;
        const last = _prewarmedAuthors.get(authorJid) || 0;
        if (Date.now() - last < 4 * 60 * 1000) return;
        _prewarmedAuthors.set(authorJid, Date.now());
        if (_prewarmedAuthors.size > 1000) _prewarmedAuthors.clear();
        if (typeof sock.getUSyncDevices === 'function') {
            const devices = await sock.getUSyncDevices([authorJid], true, false).catch(() => null);
            const deviceJids = Array.isArray(devices)
                ? devices.map(d => (typeof d === 'string' ? d : d?.jid || (d?.user ? `${d.user}${d.device ? ':' + d.device : ''}@${d.server || (authorJid.endsWith('@lid') ? 'lid' : 's.whatsapp.net')}` : null))).filter(Boolean)
                : [];
            if (deviceJids.length && typeof sock.assertSessions === 'function') {
                await sock.assertSessions(deviceJids, false).catch(() => {});
            }
        } else if (typeof sock.assertSessions === 'function') {
            await sock.assertSessions([authorJid], false).catch(() => {});
        }
    } catch (_) {}
}

async function processStatusItem(sock, msg, config, ignoreList, debug, viaFallback = false) {
    const key = msg.key;
    const msgId = statusMsgId(key);
    if (reactedStatusKeys.has(msgId) || inFlightStatusKeys.has(msgId)) return;
    if (revokedStatusIds.has(key.id)) return;
    inFlightStatusKeys.add(msgId);
    clearPendingStub(msgId);

    try {
        const historyEntry = trackStatusEvent(msg, key, {
            isFromMe: false,
            viewStatus: 'pending',
            reactStatus: 'pending'
        });
        if (historyEntry && viaFallback) historyEntry.note = 'reacted via ciphertext fallback';

        const senderNum = (key.participant || '').split('@')[0];
        if (senderNum && ignoreList.includes(senderNum)) {
            reactedStatusKeys.add(msgId);
            if (historyEntry) {
                historyEntry.viewStatus = 'ignored';
                historyEntry.reactStatus = 'ignored';
            }
            return;
        }

        // Natural human delay & pacing (3 to 8 seconds total) to simulate human behavior and prevent automated bot detection bans
        // 1. Initial view delay: 2,000ms - 4,500ms (simulate noticing status and opening story)
        // 2. Reaction delay: 1,500ms - 3,500ms (simulate viewing story and tapping emoji reaction)
        const minViewDelay = parseInt(process.env.AUTO_STATUS_VIEW_DELAY_MIN || '2000', 10);
        const maxViewDelay = parseInt(process.env.AUTO_STATUS_VIEW_DELAY_MAX || '4500', 10);
        const minReactDelay = parseInt(process.env.AUTO_STATUS_REACT_DELAY_MIN || '1500', 10);
        const maxReactDelay = parseInt(process.env.AUTO_STATUS_REACT_DELAY_MAX || '3500', 10);

        const viewDelayMs = Math.floor(Math.random() * (maxViewDelay - minViewDelay + 1)) + minViewDelay;
        const reactDelayMs = Math.floor(Math.random() * (maxReactDelay - minReactDelay + 1)) + minReactDelay;

        // Step 1: Humanized View Delay
        if (config.view) {
            await new Promise(r => setTimeout(r, viewDelayMs));
            if (revokedStatusIds.has(key.id)) return; // Abort if deleted during delay

            Promise.resolve()
                .then(() => sock.readMessages([key]))
                .then(() => {
                    statusStats.totalViewed++;
                    if (historyEntry) historyEntry.viewStatus = 'viewed';
                    if (debug) console.log(`[AUTOSTATUS] 👀 Viewed status ${key.id} from ${key.participant || 'contact'} (after ${(viewDelayMs / 1000).toFixed(1)}s)`);
                })
                .catch(err => {
                    if (historyEntry) historyEntry.viewStatus = 'failed';
                    console.error(`[AUTOSTATUS] ❌ Failed to view status ${key.id}:`, err.message);
                });
        } else if (historyEntry) {
            historyEntry.viewStatus = 'disabled';
        }

        // Step 2: Humanized React Delay (combined total 3.5s - 8.0s)
        if (config.react) {
            const actualReactDelay = config.view ? reactDelayMs : (viewDelayMs + reactDelayMs);
            await new Promise(r => setTimeout(r, actualReactDelay));
            if (revokedStatusIds.has(key.id)) return; // Abort if deleted during delay

            const strat = Number(config.strategy) || 1;
            const emoji = getStatusEmoji(config);
            if (historyEntry) {
                historyEntry.strategyUsed = strat;
                historyEntry.emojiUsed = emoji;
            }
            let success = await reactToStatus(sock, key, emoji, strat);
            if (!success) {
                _prewarmedAuthors.delete(key.participant);
                await prewarmStatusAuthor(sock, key.participant);
                await new Promise(r => setTimeout(r, 1500));
                success = await reactToStatus(sock, key, emoji, strat);
            }
            if (success) {
                reactedStatusKeys.add(msgId);
                statusStats.totalReacted++;
                if (historyEntry) historyEntry.reactStatus = 'reacted';
                const totalDelaySec = (((config.view ? viewDelayMs : 0) + actualReactDelay) / 1000).toFixed(1);
                if (debug) console.log(`[AUTOSTATUS] ✅ Reacted ${key.id}${viaFallback ? ' (fallback)' : ''} with ${emoji} (after ${totalDelaySec}s)`);
            } else {
                statusStats.totalErrors++;
                if (historyEntry) historyEntry.reactStatus = 'failed';
            }
        } else {
            reactedStatusKeys.add(msgId);
            if (historyEntry) historyEntry.reactStatus = 'disabled';
        }
    } finally {
        inFlightStatusKeys.delete(msgId);
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

        let msgs = [];
        if (Array.isArray(status)) {
            msgs = status;
        } else if (status?.messages && Array.isArray(status.messages)) {
            msgs = status.messages;
        } else if (status?.key && (status.message || status.messageStubType)) {
            msgs = [status];
        }
        // NOTE: reaction events ({ key, reaction }) are NOT statuses and are intentionally ignored
        if (!msgs || msgs.length === 0) return;

        if (reactedStatusKeys.size > 2000) reactedStatusKeys.clear();
        if (revokedStatusIds.size > 2000) revokedStatusIds.clear();

        const ignoreList = await getCachedIgnoreList();
        const debug = process.env.VERBOSE_LOGS === 'true' || process.env.DEBUG === 'true';

        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const key = msg?.key;
            if (!key || key.remoteJid !== 'status@broadcast') continue;

            const skipReason = getStatusSkipReason(msg, sock);

            if (skipReason === 'protocol/revoke') {
                // Status deleted: remember the deleted id and cancel any pending fallback reaction
                const revokedId = unwrapStatusMessage(msg.message)?.protocolMessage?.key?.id;
                if (revokedId) {
                    revokedStatusIds.add(revokedId);
                    clearPendingStub(`${key.participant || ''}:${revokedId}`);
                }
                if (debug) console.log(`[AUTOSTATUS] 🗑️ Status ${revokedId || '?'} deleted by ${key.participant || 'contact'} — not reacting`);
                continue;
            }

            if (skipReason === 'ciphertext') {
                // First status from a contact: pre-warm sessions now, wait for the decrypted retry copy,
                // and fall back to reacting with this key if it never arrives.
                const msgId = statusMsgId(key);
                prewarmStatusAuthor(sock, key.participant).catch(() => {});
                if (!pendingStubStatuses.has(msgId) && !reactedStatusKeys.has(msgId)) {
                    const timer = setTimeout(() => {
                        pendingStubStatuses.delete(msgId);
                        if (reactedStatusKeys.has(msgId) || inFlightStatusKeys.has(msgId) || revokedStatusIds.has(key.id)) return;
                        processStatusItem(sock, msg, config, ignoreList, debug, true)
                            .catch(err => console.error('[AUTOSTATUS] ❌ Fallback error:', err.message));
                    }, STUB_FALLBACK_MS);
                    if (timer.unref) timer.unref();
                    pendingStubStatuses.set(msgId, timer);
                }
                if (debug) console.log(`[AUTOSTATUS] 🔐 Status ${key.id} not yet decrypted (${msg.messageStubParameters?.[0] || 'no content'}) — waiting for retry copy`);
                continue;
            }

            if (skipReason) {
                if (skipReason === 'own' || skipReason === 'own-lid') {
                    trackStatusEvent(msg, key, { isFromMe: true, viewStatus: 'own status (skipped)', reactStatus: 'own status (skipped)' });
                }
                if (debug) console.log(`[AUTOSTATUS] ⏭️ Skip ${key.id} (${skipReason})`);
                continue;
            }

            await processStatusItem(sock, msg, config, ignoreList, debug, false);

            // Inter-status pacing delay when multiple statuses arrive in the same upsert
            if (msgs.length > 1 && i < msgs.length - 1) {
                await new Promise(r => setTimeout(r, 250));
            }
        }
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
            const activeStrategyName = STRATEGY_DESCRIPTIONS[cfg.strategy] || STRATEGY_DESCRIPTIONS[1];

            if (!args || args.length === 0) {
                let privacyNote = '';
                try {
                    const privacy = await sock.fetchPrivacySettings?.();
                    const rr = privacy?.readreceipts || 'unknown';
                    privacyNote = rr !== 'all'
                        ? `\n⚠️ *Bot Read Receipts:* *${rr}* (Status posters may NOT see views. Type \`.autostatus readreceipts on\` to fix)`
                        : `\n✅ *Bot Read Receipts:* *${rr}* (Views visible to status posters)`;
                } catch (_) {}

                let emojiDisplay = cfg.reaction;
                if (cfg.reaction === 'random') {
                    emojiDisplay = `🎲 Random (${(cfg.emojis || []).slice(0, 8).join(' ')}${cfg.emojis?.length > 8 ? '...' : ''})`;
                }

                return await sock.sendMessage(chatId, {
                    text: `📱 *AutoStatus Settings*\n\n` +
                        `👁️ *Auto View:* *${cfg.view ? 'ON' : 'OFF'}* (Views status updates immediately)\n` +
                        `💫 *Auto React:* *${cfg.react ? 'ON' : 'OFF'}* (Reacts to status updates)\n` +
                        `✨ *Reaction Emoji:* ${emojiDisplay}\n` +
                        `🎨 *Emoji Pool:* ${(cfg.emojis || []).join(' ')}\n` +
                        `⚙️ *Reaction Strategy:* *Strategy ${cfg.strategy}* (${activeStrategyName})\n` +
                        `🗄️ *Storage:* ${HAS_DB ? 'Database' : 'File System'}\n` +
                        `🚫 *Ignored Contacts:* ${ignoreList.length}` +
                        privacyNote + `\n\n` +
                        `*Commands:*\n` +
                        `• \`.autostatus view on/off\` - Toggle status viewing\n` +
                        `• \`.autostatus react on/off\` - Toggle status reaction\n` +
                        `• \`.autostatus strategy <1-12>\` - Set reaction strategy (1 to 12)\n` +
                        `• \`.autostatus reaction <emoji|random|list>\` - Set reaction emoji or emoji pool\n` +
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
                const emojiToUse = requestedEmoji || (cfg.reaction && cfg.reaction !== 'random' ? cfg.reaction : getStatusEmoji(cfg)) || '💚';

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
                        const sEmoji = requestedEmoji || ((isAll || isNew) ? STRATEGY_DEFAULT_EMOJIS[sNum] : (getStatusEmoji(cfg) || STRATEGY_DEFAULT_EMOJIS[sNum])) || emojiToUse;
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

            if (sub === 'reaction' || sub === 'emoji' || sub === 'emojis') {
                const input = args.slice(1).join(' ').trim();
                if (!input) {
                    const currentDisplay = cfg.reaction === 'random'
                        ? `🎲 Random (Pool: ${(cfg.emojis || []).join(' ')})`
                        : cfg.reaction;
                    return await sock.sendMessage(chatId, {
                        text: `✨ *AutoStatus Reaction Emoji Settings:*\n\n` +
                            `• *Current Reaction:* ${currentDisplay}\n` +
                            `• *Active Emoji Pool:* ${(cfg.emojis || []).join(' ')}\n\n` +
                            `*Usage:*\n` +
                            `• \`.autostatus reaction ❤️\` - Set a single reaction emoji\n` +
                            `• \`.autostatus reaction random\` - Randomize using active emoji pool\n` +
                            `• \`.autostatus reaction ❤️,🔥,✨,💯,👍\` - Update emoji pool & randomize`,
                        ...channelInfo
                    }, { quoted: message });
                }

                if (input.toLowerCase() === 'random') {
                    cfg.reaction = 'random';
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, {
                        text: `✅ AutoStatus reaction set to *Random*!\nBot will react using the emoji pool: ${(cfg.emojis || []).join(' ')}`,
                        ...channelInfo
                    }, { quoted: message });
                }

                const parsed = parseEmojiList(input);
                if (parsed.length > 1) {
                    cfg.emojis = parsed;
                    cfg.reaction = 'random';
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, {
                        text: `✅ AutoStatus emoji pool updated (${parsed.length} emojis) and set to *Random*!\nPool: ${parsed.join(' ')}`,
                        ...channelInfo
                    }, { quoted: message });
                } else if (parsed.length === 1) {
                    cfg.reaction = parsed[0];
                    await writeConfig(cfg);
                    return await sock.sendMessage(chatId, {
                        text: `✅ AutoStatus reaction emoji set to ${parsed[0]}`,
                        ...channelInfo
                    }, { quoted: message });
                } else {
                    return await sock.sendMessage(chatId, {
                        text: `❌ Could not detect valid emojis in: "${input}". Please provide valid emoji(s).`,
                        ...channelInfo
                    }, { quoted: message });
                }
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
                    emojis: config.emojis,
                    effectiveEmojiSample: getStatusEmoji(config),
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
    invalidateConfigCache,
    getStatusEmoji,
    parseEmojiList,
    STRATEGY_DESCRIPTIONS,
    STRATEGY_DEFAULT_EMOJIS,
    statusStats,
    distinctLids,
    recentStatusHistory,
    recentStatusCache,
    cacheRecentStatus
};

