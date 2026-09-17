const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

const AI_API_URL = 'https://mistral-conversational.vercel.app/api/chat';
const SETTING_KEY = 'aimode';

// 10 Official Persona Modes from Conversational API (/docs)
const MODES = {
    'gen-co': {
        slug: 'gen-co',
        name: 'General Conversational',
        tagline: 'Balanced, articulate, and natural daily assistant',
        category: 'Conversational',
        defaultLevel: 3,
        temperature: 0.7
    },
    'gen-co-em': {
        slug: 'gen-co-em',
        name: 'General Conversational (Emojis)',
        tagline: 'Vibrant, expressive, and friendly with emojis',
        category: 'Conversational',
        defaultLevel: 3,
        temperature: 0.8
    },
    'prof-tech': {
        slug: 'prof-tech',
        name: 'Professional & Technical',
        tagline: 'Rigorous, analytical engineering consultant',
        category: 'Technical',
        defaultLevel: 3,
        temperature: 0.3
    },
    'socratic': {
        slug: 'socratic',
        name: 'Socratic Guide',
        tagline: 'Thought-provoking inquiry and guided reasoning',
        category: 'Educational',
        defaultLevel: 3,
        temperature: 0.6
    },
    'eli5': {
        slug: 'eli5',
        name: "Explain Like I'm 5",
        tagline: 'Intuitive analogies and jargon-free simplicity',
        category: 'Educational',
        defaultLevel: 3,
        temperature: 0.7
    },
    'concise': {
        slug: 'concise',
        name: 'Bullet / Ultra-Concise',
        tagline: 'Zero fluff, maximum signal-to-noise ratio',
        category: 'Productivity',
        defaultLevel: 2,
        temperature: 0.2
    },
    'code-mentor': {
        slug: 'code-mentor',
        name: 'Software Architect & Mentor',
        tagline: 'Production-ready code, clean architecture & gotchas',
        category: 'Technical',
        defaultLevel: 3,
        temperature: 0.3
    },
    'creative': {
        slug: 'creative',
        name: 'Creative & Storyteller',
        tagline: 'Imaginative prose, world-building, and vivid metaphors',
        category: 'Creative',
        defaultLevel: 3,
        temperature: 0.9
    },
    'zen': {
        slug: 'zen',
        name: 'Zen Master',
        tagline: 'Calm, mindful clarity, stillness, and centered wisdom',
        category: 'Philosophy',
        defaultLevel: 3,
        temperature: 0.5
    },
    'medieval': {
        slug: 'medieval',
        name: 'Medieval Knight & Chronicler',
        tagline: 'Chivalric prose, archaic flair, and royal chronicle',
        category: 'Historical',
        defaultLevel: 3,
        temperature: 0.8
    }
};

// Aliases mapping for flexible user input in Private DMs
const MODE_ALIASES = {
    'gen-co': 'gen-co',
    'genco': 'gen-co',
    'default': 'gen-co',
    'general': 'gen-co',
    'conversational': 'gen-co',
    'normal': 'gen-co',
    'standard': 'gen-co',

    'gen-co-em': 'gen-co-em',
    'gencoem': 'gen-co-em',
    'emoji': 'gen-co-em',
    'emojis': 'gen-co-em',
    'fun': 'gen-co-em',
    'expressive': 'gen-co-em',

    'prof-tech': 'prof-tech',
    'proftech': 'prof-tech',
    'tech': 'prof-tech',
    'technical': 'prof-tech',
    'pro': 'prof-tech',
    'professional': 'prof-tech',
    'engineer': 'prof-tech',
    'architect': 'prof-tech',

    'socratic': 'socratic',
    'tutor': 'socratic',
    'guide': 'socratic',
    'inquiry': 'socratic',
    'mentor': 'socratic',
    'reasoning': 'socratic',

    'eli5': 'eli5',
    'simple': 'eli5',
    'kid': 'eli5',
    'beginner': 'eli5',
    'easy': 'eli5',

    'concise': 'concise',
    'bullet': 'concise',
    'brief': 'concise',
    'short': 'concise',
    'fast': 'concise',
    'summary': 'concise',

    'code-mentor': 'code-mentor',
    'codementor': 'code-mentor',
    'code': 'code-mentor',
    'coding': 'code-mentor',
    'developer': 'code-mentor',
    'dev': 'code-mentor',
    'program': 'code-mentor',
    'programmer': 'code-mentor',

    'creative': 'creative',
    'story': 'creative',
    'storyteller': 'creative',
    'writer': 'creative',
    'artistic': 'creative',

    'zen': 'zen',
    'peace': 'zen',
    'calm': 'zen',
    'monk': 'zen',
    'meditation': 'zen',
    'mindful': 'zen',
    'stillness': 'zen',

    'medieval': 'medieval',
    'knight': 'medieval',
    'archaic': 'medieval',
    'king': 'medieval',
    'royal': 'medieval',
    'courtly': 'medieval',
    'chivalry': 'medieval'
};

const DEPTH_LEVELS = {
    1: 'DEPTH LEVEL 1 (Ultra-Brief): 1-2 sentence response maximum, zero fluff.',
    2: 'DEPTH LEVEL 2 (Concise Summary): 2-3 high-impact bullet points or short paragraphs.',
    3: 'DEPTH LEVEL 3 (Comprehensive - Default): Well-structured, balanced detail & context.',
    4: 'DEPTH LEVEL 4 (Deep-Dive): Mechanics, edge cases, trade-offs, and practical examples.',
    5: 'DEPTH LEVEL 5 (Masterclass): Exhaustive architectural breakdown and best practices.'
};

// Multi-turn conversation memory store: chatId -> { history: Array, lastActive: number }
const conversationHistory = new Map();
const MAX_TURNS = 6;
const STALE_TTL = 30 * 60 * 1000; // 30 minutes

function getChatHistory(chatId) {
    const entry = conversationHistory.get(chatId);
    if (!entry) return [];
    if (Date.now() - entry.lastActive > STALE_TTL) {
        conversationHistory.delete(chatId);
        return [];
    }
    return entry.history || [];
}

function updateChatHistory(chatId, history, userMsg, botMsg) {
    const updated = Array.isArray(history) ? [...history] : [];
    if (userMsg) updated.push({ role: 'user', content: userMsg });
    if (botMsg) updated.push({ role: 'assistant', content: botMsg });
    while (updated.length > MAX_TURNS * 2) {
        updated.splice(0, 2);
    }
    conversationHistory.set(chatId, {
        history: updated,
        lastActive: Date.now()
    });
}

// Periodic cleanup of stale memory entries (with unref to never hold process alive)
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of conversationHistory.entries()) {
        if (!entry || !entry.lastActive || (now - entry.lastActive > STALE_TTL)) {
            conversationHistory.delete(id);
        }
    }
}, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

// Humorous system prompt for incoming media in private direct messages
const HUMOROUS_MEDIA_SYSTEM_PROMPT =
    'You are a witty, hilarious comedian and friendly roaster with a playful sense of humor. ' +
    'The user has just sent a piece of media (image, video, sticker, audio, or document) in a WhatsApp chat. ' +
    'Give a sharp, funny, humorous, playful comment or roast about it in 1-2 punchy sentences with fun emojis. ' +
    'Never be boring or robotic. Keep it entertaining and good-natured!';

/**
 * Cleanly resolves user-supplied input into a valid WhatsApp JID.
 * Supports phone numbers (e.g. 254712345678, +254712345678),
 * user JIDs (254712345678@s.whatsapp.net), group JIDs (120363xxxxxx@g.us),
 * hyphenated legacy group JIDs (12345-67890@g.us), and @mention tokens.
 */
function resolveTargetJid(input) {
    if (!input || typeof input !== 'string') return null;
    let s = input.trim();
    if (!s) return null;

    // Strip URL wrappers if any
    s = s.replace(/^https?:\/\/(?:api\.)?whatsapp\.com\/send\?phone=/i, '');
    s = s.replace(/^https?:\/\/wa\.me\//i, '');
    s = s.replace(/^whatsapp:/i, '');

    // Strip leading @
    if (s.startsWith('@')) s = s.slice(1);

    // If explicit WhatsApp domain is present
    if (s.endsWith('@s.whatsapp.net') || s.endsWith('@g.us') || s.endsWith('@lid')) {
        if (s.endsWith('@s.whatsapp.net')) {
            const num = s.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            return num ? `${num}@s.whatsapp.net` : null;
        }
        return s;
    }

    // Hyphenated legacy group ID (e.g. 123456789-987654321)
    if (s.includes('-') && /^\d+-\d+$/.test(s)) {
        return `${s}@g.us`;
    }

    // Clean digits
    const cleanDigits = s.replace(/[^0-9]/g, '');
    if (!cleanDigits) return null;

    // Modern WhatsApp group JID starts with 120363 and is 17-20 digits
    if (cleanDigits.startsWith('120363') && cleanDigits.length >= 17) {
        return `${cleanDigits}@g.us`;
    }

    // Standard phone number (7 to 16 digits)
    if (cleanDigits.length >= 7 && cleanDigits.length <= 16) {
        return `${cleanDigits}@s.whatsapp.net`;
    }

    return null;
}

/**
 * Parses multi-parameter argument strings with flexible token ordering.
 * e.g.:
 *  .aimode default 1 <jid>
 *  .aimode on <mode> [level] [jid]
 *  .aimode <mode> [level] [jid]
 *  .aimode off [jid]
 *  .aimode status [jid]
 *  .aimode reset [jid]
 */
function parseAiModeArgs(args) {
    let targetJid = null;
    let explicitAction = null; // 'on', 'off', 'status', 'info', 'reset', 'level', 'mode', 'help'
    let parsedMode = null;
    let parsedLevel = null;
    let invalidJidAttempt = null;
    const unrecognized = [];

    const rawArgs = Array.isArray(args) ? args : [];
    for (let i = 0; i < rawArgs.length; i++) {
        const raw = String(rawArgs[i] || '').trim();
        if (!raw) continue;
        const lower = raw.toLowerCase();

        // 1. Check for combined phone number with spaces (e.g. +254 712 345 678)
        if (!targetJid && (raw.startsWith('+') || (/^\d{2,5}$/.test(raw) && !/^[1-5]$/.test(raw)))) {
            let combined = raw;
            let lookAhead = i + 1;
            while (lookAhead < rawArgs.length && /^\d+$/.test(String(rawArgs[lookAhead]).trim())) {
                combined += String(rawArgs[lookAhead]).trim();
                lookAhead++;
            }
            if (lookAhead > i + 1) {
                const resolvedCombined = resolveTargetJid(combined);
                if (resolvedCombined) {
                    targetJid = resolvedCombined;
                    i = lookAhead - 1;
                    continue;
                }
            }
        }

        // 2. Check for Target JID / Phone Number
        if (!targetJid) {
            const resolved = resolveTargetJid(raw);
            if (resolved) {
                targetJid = resolved;
                continue;
            }
        }

        // 3. Keyword prefixes with next arg:
        // 'mode <slug>', 'persona <slug>', 'tone <slug>', 'style <slug>', 'set <slug>'
        if (['mode', 'persona', 'tone', 'style', 'set'].includes(lower)) {
            if (i + 1 < rawArgs.length) {
                const nextLower = String(rawArgs[i + 1] || '').toLowerCase().trim();
                if (MODE_ALIASES[nextLower]) {
                    parsedMode = MODE_ALIASES[nextLower];
                    i++;
                    continue;
                }
            }
            if (!explicitAction) explicitAction = 'mode';
            continue;
        }

        // 'level <1-5>', 'lvl <1-5>', 'depth <1-5>'
        if (['level', 'lvl', 'depth'].includes(lower)) {
            if (i + 1 < rawArgs.length) {
                const nextVal = parseInt(rawArgs[i + 1], 10);
                if (nextVal >= 1 && nextVal <= 5) {
                    parsedLevel = nextVal;
                    i++;
                    continue;
                }
            }
            if (!explicitAction) explicitAction = 'level';
            continue;
        }

        // 'to <jid>', 'jid <jid>', 'chat <jid>', 'target <jid>'
        if (['to', 'jid', 'chat', 'target'].includes(lower)) {
            if (i + 1 < rawArgs.length) {
                const resolved = resolveTargetJid(rawArgs[i + 1]);
                if (resolved) {
                    targetJid = resolved;
                    i++;
                    continue;
                }
            }
            continue;
        }

        // 4. Actions
        if (['on', 'enable', 'start'].includes(lower)) {
            explicitAction = 'on';
            continue;
        }
        if (['off', 'disable', 'stop'].includes(lower)) {
            explicitAction = 'off';
            continue;
        }
        if (['status', 'info', 'check', 'view'].includes(lower)) {
            explicitAction = 'status';
            continue;
        }
        if (['reset', 'clear'].includes(lower)) {
            explicitAction = 'reset';
            continue;
        }
        if (['help', 'menu'].includes(lower)) {
            explicitAction = 'help';
            continue;
        }

        // 5. Depth Level (1 - 5)
        if (/^[1-5]$/.test(lower)) {
            if (!parsedLevel) {
                parsedLevel = parseInt(lower, 10);
                continue;
            }
        }

        // 6. Mode Alias
        if (MODE_ALIASES[lower]) {
            if (!parsedMode) {
                parsedMode = MODE_ALIASES[lower];
                continue;
            }
        }

        // Check if user attempted a JID but formatted it incorrectly
        if (raw.includes('@') || raw.startsWith('+') || /^\d{6,}$/.test(raw.replace(/[^0-9]/g, ''))) {
            invalidJidAttempt = raw;
            continue;
        }

        unrecognized.push(raw);
    }

    return {
        targetJid,
        explicitAction,
        parsedMode,
        parsedLevel,
        invalidJidAttempt,
        unrecognized
    };
}

/**
 * Retrieves AI mode configuration for a specific chat
 */
async function getAiConfig(chatId) {
    try {
        let data = await store.getSetting(chatId, SETTING_KEY);
        if (!data) {
            // Fallback check for legacy chatbot setting
            data = await store.getSetting(chatId, 'chatbot');
        }
        if (data && typeof data === 'object') {
            return {
                enabled: !!data.enabled,
                mode: chatId.endsWith('@g.us') ? 'gen-co' : (data.mode || 'gen-co'),
                level: chatId.endsWith('@g.us') ? 3 : (typeof data.level === 'number' ? data.level : 3)
            };
        }
        if (typeof data === 'boolean') {
            return {
                enabled: data,
                mode: 'gen-co',
                level: 3
            };
        }
    } catch (e) {
        console.error('[AI-MODE] Error reading config:', e.message);
    }
    return {
        enabled: false,
        mode: 'gen-co',
        level: 3
    };
}

/**
 * Saves AI mode configuration for a specific chat
 */
async function saveAiConfig(chatId, config) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        const toSave = {
            enabled: !!config.enabled,
            mode: isGroup ? 'gen-co' : (config.mode || 'gen-co'),
            level: isGroup ? 3 : (typeof config.level === 'number' ? config.level : 3)
        };
        await store.saveSetting(chatId, SETTING_KEY, toSave);
        return true;
    } catch (e) {
        console.error('[AI-MODE] Error saving config:', e.message);
        return false;
    }
}

/**
 * Calls Conversational API endpoint
 */
async function callAiChat({ message, mode = 'gen-co', level = 3, history = [], systemPromptOverride = null }, retries = 1) {
    const payload = {
        message: String(message || '').trim(),
        mode,
        level: Number(level) || 3,
        stream: false,
        history: Array.isArray(history) ? history.slice(-MAX_TURNS) : [],
        model: 'ministral-8b-2512'
    };

    if (systemPromptOverride) {
        payload.systemPromptOverride = systemPromptOverride;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MEGA-MD-AI/1.0'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error || `HTTP ${response.status} ${response.statusText}`;
            console.error('[AI-MODE] API error:', errMsg);
            return { success: false, error: errMsg };
        }

        const data = await response.json();
        if (!data || !data.success || !data.message) {
            return { success: false, error: data?.error || 'Empty response from AI service' };
        }

        return {
            success: true,
            message: data.message.trim(),
            mode: data.mode,
            level: data.level
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('[AI-MODE] API timed out after 35s');
            return { success: false, error: 'Request timed out' };
        }
        if (retries > 0) {
            console.warn(`[AI-MODE] API fetch failed (${err.message}). Retrying in 1s...`);
            await new Promise(r => setTimeout(r, 1000));
            return callAiChat({ message, mode, level, history, systemPromptOverride }, retries - 1);
        }
        console.error('[AI-MODE] API call failed:', err.message);
        return { success: false, error: err.message };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Extracts media information if incoming message contains media
 */
function getMediaType(msg) {
    if (!msg) return null;
    let m = msg;
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

    if (m.imageMessage) return { type: 'image', caption: m.imageMessage.caption || '' };
    if (m.videoMessage) return { type: 'video', caption: m.videoMessage.caption || '' };
    if (m.ptvMessage) return { type: 'video note', caption: m.ptvMessage.caption || '' };
    if (m.stickerMessage) return { type: 'sticker', caption: '' };
    if (m.audioMessage) return { type: m.audioMessage.ptt ? 'voice note' : 'audio', caption: '' };
    if (m.documentMessage) return { type: 'document', caption: m.documentMessage.caption || m.documentMessage.fileName || '' };
    return null;
}

/**
 * Helper to extract contextInfo across any Baileys message wrapper
 */
function extractContextInfo(msg) {
    if (!msg) return null;
    let m = msg;
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

    if (m.contextInfo) return m.contextInfo;
    for (const key of Object.keys(m)) {
        if (m[key] && typeof m[key] === 'object' && m[key].contextInfo) {
            return m[key].contextInfo;
        }
    }
    return null;
}

/**
 * Helper to extract text from quoted message
 */
function getQuotedText(contextInfo) {
    if (!contextInfo?.quotedMessage) return '';
    const q = contextInfo.quotedMessage;
    return (
        q.conversation ||
        q.extendedTextMessage?.text ||
        q.imageMessage?.caption ||
        q.videoMessage?.caption ||
        q.documentMessage?.caption ||
        ''
    ).trim();
}

/**
 * Checks if the bot is explicitly mentioned or replied to in a group
 */
function isBotAddressedInGroup(sock, message, innerMsg, userMessage) {
    const botId = sock?.user?.id || sock?.user?.jid || '';
    if (!botId) return false;

    const botNumber = botId.split(':')[0].split('@')[0];
    const botLid = sock?.user?.lid || '';
    const botLidNumber = botLid ? botLid.split(':')[0].split('@')[0] : '';

    const botJidTargets = new Set([
        botNumber,
        botId,
        `${botNumber}@s.whatsapp.net`,
        `${botNumber}@whatsapp.net`
    ]);
    if (botLidNumber) {
        botJidTargets.add(botLidNumber);
        botJidTargets.add(`${botLidNumber}@lid`);
    }
    if (sock?.user?.jid) {
        botJidTargets.add(sock.user.jid);
    }

    const contextInfo = extractContextInfo(innerMsg) || extractContextInfo(message?.message);

    if (contextInfo) {
        // 1. Check mentionedJid array
        const mentioned = contextInfo.mentionedJid || [];
        for (const jid of mentioned) {
            if (!jid) continue;
            const cleanNum = jid.split(':')[0].split('@')[0];
            if (botJidTargets.has(cleanNum) || botJidTargets.has(jid)) {
                return true;
            }
        }

        // 2. Check quoted message participant (reply to bot)
        const participant = contextInfo.participant || '';
        if (participant) {
            const cleanPart = participant.split(':')[0].split('@')[0];
            if (botJidTargets.has(cleanPart) || botJidTargets.has(participant)) {
                return true;
            }
        }
    }

    // 3. Text contains @<botNumber>
    if (botNumber && userMessage && userMessage.includes(`@${botNumber}`)) {
        return true;
    }

    return false;
}

/**
 * Non-command message handler for AI Mode responses
 */
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId, innerMsg = null, rawText = '') {
    try {
        // Safeguard 1: Do not create infinite reply loops (ignore self)
        if (!message || message.key?.fromMe) return;
        if (!chatId) return;

        const isGroup = chatId.endsWith('@g.us');

        // Check if AI Mode is enabled for this chat
        const config = await getAiConfig(chatId);
        if (!config || !config.enabled) return;

        const actualMsg = innerMsg || message.message || {};
        const media = getMediaType(actualMsg);

        // Group chats logic
        if (isGroup) {
            // Group chats: ONLY respond if bot is explicitly mentioned or replied to
            const addressed = isBotAddressedInGroup(sock, message, actualMsg, userMessage);
            if (!addressed) return;

            // Group chats: Strictly restricted to conversational mode (gen-co)
            const botId = sock.user?.id || sock.user?.jid || '';
            const botNumber = (botId || '').split(':')[0].split('@')[0];

            let promptText = (rawText || userMessage || '').trim();
            if (botNumber) {
                promptText = promptText.replace(new RegExp(`@${botNumber}\\b`, 'g'), '').trim();
            }

            if (!promptText && media) {
                promptText = media.caption ? media.caption : `Hello! What do you think of this ${media.type}?`;
            } else if (!promptText) {
                promptText = 'Hello!';
            }

            // If replying to a bot message and history is empty, attach quoted context
            const contextInfo = extractContextInfo(actualMsg) || extractContextInfo(message.message);
            const quotedText = getQuotedText(contextInfo);
            const history = getChatHistory(chatId);
            if (quotedText && history.length === 0 && !promptText.includes(quotedText)) {
                promptText = `[Replying to: "${quotedText}"] ${promptText}`;
            }

            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', chatId);
            } catch {}

            const result = await callAiChat({
                message: promptText,
                mode: 'gen-co',
                level: 3,
                history
            });

            try {
                await sock.sendPresenceUpdate('paused', chatId);
            } catch {}

            if (result.success && result.message) {
                updateChatHistory(chatId, history, promptText, result.message);
                await sock.sendMessage(chatId, { text: result.message }, { quoted: message });
            } else {
                console.error(`[AI-MODE] Group response failed: ${result.error}`);
                await sock.sendMessage(chatId, {
                    text: "⚠️ I'm currently having trouble connecting to the AI service. Please try again in a moment!"
                }, { quoted: message }).catch(() => {});
            }
            return;
        }

        // Private Direct Messages logic
        if (!isGroup) {
            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', chatId);
            } catch {}

            // Handle incoming media in humorous tone
            if (media) {
                const mediaPrompt = media.caption && media.caption.trim()
                    ? `[User sent a ${media.type} with caption: "${media.caption.trim()}"]`
                    : `[User sent a ${media.type} with no caption]`;

                const history = getChatHistory(chatId);
                const result = await callAiChat({
                    message: mediaPrompt,
                    mode: config.mode || 'gen-co',
                    level: 2, // punchy summary for humorous roasts
                    history: history.slice(-4),
                    systemPromptOverride: HUMOROUS_MEDIA_SYSTEM_PROMPT
                });

                try {
                    await sock.sendPresenceUpdate('paused', chatId);
                } catch {}

                if (result.success && result.message) {
                    updateChatHistory(chatId, history, mediaPrompt, result.message);
                    await sock.sendMessage(chatId, { text: result.message }, { quoted: message });
                } else {
                    console.error(`[AI-MODE] Humorous media response failed: ${result.error}`);
                    await sock.sendMessage(chatId, {
                        text: "⚠️ I'm currently having trouble generating a funny roast. Please try again in a moment!"
                    }, { quoted: message }).catch(() => {});
                }
                return;
            }

            // Handle incoming text automatically without requiring mention or reply
            const promptText = (rawText || userMessage || '').trim();
            if (!promptText) return;

            const history = getChatHistory(chatId);
            const result = await callAiChat({
                message: promptText,
                mode: config.mode || 'gen-co',
                level: config.level || 3,
                history
            });

            try {
                await sock.sendPresenceUpdate('paused', chatId);
            } catch {}

            if (result.success && result.message) {
                updateChatHistory(chatId, history, promptText, result.message);
                await sock.sendMessage(chatId, { text: result.message }, { quoted: message });
            } else {
                console.error(`[AI-MODE] Private DM response failed: ${result.error}`);
                await sock.sendMessage(chatId, {
                    text: "⚠️ I'm currently having trouble connecting to the AI service. Please try again in a moment!"
                }, { quoted: message }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('[AI-MODE] Exception in handleChatbotResponse:', err.message);
    }
}

/**
 * Command Handler (.aimode / .chatbot / .chatgpt / .autochat)
 */
async function handler(sock, message, args, context = {}) {
    const currentChatId = context.chatId || message.key.remoteJid;
    const isCurrentGroup = currentChatId.endsWith('@g.us');
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;

    // Check caller privileges
    let isOwnerOrSudoCheck = !!(context.isOwnerOrSudoCheck || message.key.fromMe);
    if (!isOwnerOrSudoCheck) {
        try {
            isOwnerOrSudoCheck = await isOwnerOrSudo(senderId, sock, currentChatId);
        } catch {
            isOwnerOrSudoCheck = false;
        }
    }

    let isSenderAdmin = context.isSenderAdmin;
    if (isCurrentGroup && typeof isSenderAdmin !== 'boolean') {
        try {
            const adminStatus = await isAdmin(sock, currentChatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
        } catch {
            isSenderAdmin = false;
        }
    }

    // Parse all-in-one argument string
    const parsed = parseAiModeArgs(args);

    // If an invalid JID format was attempted
    if (parsed.invalidJidAttempt) {
        return sock.sendMessage(currentChatId, {
            text: `❌ *Invalid Target JID / Phone Number:* "${parsed.invalidJidAttempt}"\n\n` +
                  `Please provide a valid phone number (e.g. \`254712345678\`) or WhatsApp JID (e.g. \`120363xxxxxx@g.us\`).`
        }, { quoted: message });
    }

    const targetChatId = parsed.targetJid || currentChatId;
    const isRemoteTarget = targetChatId !== currentChatId;
    const targetIsGroup = targetChatId.endsWith('@g.us');

    // 1. Permission checks
    if (isRemoteTarget) {
        // JID supplied: Caller must be bot owner/sudo OR group admin of current group
        const hasPermission = isOwnerOrSudoCheck || (isCurrentGroup && isSenderAdmin);
        if (!hasPermission) {
            return sock.sendMessage(currentChatId, {
                text: '❌ *Permission Denied*: Only bot owners, sudo users, or group admins can target another chat by JID.'
            }, { quoted: message });
        }
    } else if (isCurrentGroup) {
        // Mutating AI mode in current group requires group admin or owner/sudo
        const isMutating = parsed.explicitAction === 'on' ||
                           parsed.explicitAction === 'off' ||
                           parsed.explicitAction === 'reset' ||
                           !!parsed.parsedMode ||
                           !!parsed.parsedLevel;

        if (isMutating && !isOwnerOrSudoCheck && !isSenderAdmin) {
            return sock.sendMessage(currentChatId, {
                text: '❌ *Permission Denied*: Only group admins or the bot owner can configure AI Mode for this group.'
            }, { quoted: message });
        }
    }

    const config = await getAiConfig(targetChatId);

    // 2. DISABLE AI MODE (.aimode off [jid])
    if (parsed.explicitAction === 'off') {
        config.enabled = false;
        await saveAiConfig(targetChatId, config);
        conversationHistory.delete(targetChatId);

        const targetDesc = isRemoteTarget ? ` for \`${targetChatId}\`` : '';
        const groupNotice = targetIsGroup
            ? `The bot will no longer reply to mentions or messages in this group.`
            : `Automatic replies and media responses are now paused.`;

        return sock.sendMessage(currentChatId, {
            text: `❌ *AI Mode Deactivated${targetDesc}!*\n\n${groupNotice}`
        }, { quoted: message });
    }

    // 3. STATUS / INFO (.aimode status [jid], .aimode info [jid])
    if (parsed.explicitAction === 'status' || parsed.explicitAction === 'info') {
        const modeObj = MODES[config.mode] || MODES['gen-co'];
        const statusIcon = config.enabled ? '✅ Enabled' : '❌ Disabled';
        const levelDesc = DEPTH_LEVELS[config.level] || DEPTH_LEVELS[3];

        let msgText = `*🤖 CONVERSATIONAL AI MODE STATUS*\n\n` +
                      `• *Target Chat:* \`${targetChatId}\`${isRemoteTarget ? ' (Remote Target)' : ' (Current Chat)'}\n` +
                      `• *Status:* ${statusIcon}\n` +
                      `• *Chat Type:* ${targetIsGroup ? 'Group Chat' : 'Private Direct Message'}\n` +
                      `• *Current Mode:* *${modeObj.name}* (\`${modeObj.slug}\`)\n` +
                      `• *Tagline:* _${modeObj.tagline}_\n` +
                      `• *Depth Level:* Level ${config.level} (${levelDesc})\n\n`;

        if (targetIsGroup) {
            msgText += `*Group Policy:*\n` +
                       `Group chats are strictly locked to Conversational Mode (\`gen-co\`) and respond only when mentioned (@bot) or replied to.`;
        } else {
            msgText += `*Private DM Customization:*\n` +
                       `Use \`.aimode <mode> [level] [jid]\` to customize persona mode or depth level.`;
        }

        return sock.sendMessage(currentChatId, { text: msgText }, { quoted: message });
    }

    // 4. RESET HISTORY & SETTINGS (.aimode reset [jid])
    if (parsed.explicitAction === 'reset') {
        config.mode = 'gen-co';
        config.level = 3;
        await saveAiConfig(targetChatId, config);
        conversationHistory.delete(targetChatId);

        const targetDesc = isRemoteTarget ? ` for \`${targetChatId}\`` : '';
        return sock.sendMessage(currentChatId, {
            text: `🔄 *AI Mode Reset to Defaults${targetDesc}!*\n\n` +
                  `• Mode reset to *General Conversational* (\`gen-co\`).\n` +
                  `• Depth level reset to Level 3 (Comprehensive).\n` +
                  `• Conversation memory cleared.`
        }, { quoted: message });
    }

    // 5. DEPTH LEVEL MENU (.aimode level [jid] without specifying level)
    if (parsed.explicitAction === 'level' && !parsed.parsedLevel) {
        if (targetIsGroup) {
            return sock.sendMessage(currentChatId, {
                text: `⚠️ *Group Restriction*: Group chats are strictly locked to default conversational settings. Depth level adjustment is available in private direct messages only.`
            }, { quoted: message });
        }

        let lvlList = `*Available Depth Levels (1 - 5):*\n\n`;
        for (let i = 1; i <= 5; i++) {
            lvlList += `• *Level ${i}*: ${DEPTH_LEVELS[i]}\n`;
        }
        lvlList += `\n*Usage:* \`.aimode level <1-5> [jid]\` (e.g. \`.aimode level 2\`)`;
        return sock.sendMessage(currentChatId, { text: lvlList }, { quoted: message });
    }

    // 6. PERSONA MODES MENU (.aimode mode [jid] without specifying slug)
    if (parsed.explicitAction === 'mode' && !parsed.parsedMode) {
        if (targetIsGroup) {
            return sock.sendMessage(currentChatId, {
                text: `⚠️ *Group Restriction*: Group chats are strictly restricted to *Conversational Mode* (\`gen-co\`). Persona customization is available in private direct messages only.`
            }, { quoted: message });
        }

        let modeList = `*🎭 Available Persona Modes (Private DMs):*\n\n`;
        let idx = 1;
        for (const [slug, m] of Object.entries(MODES)) {
            modeList += `${idx++}. *${m.name}* (\`${slug}\`)\n   _${m.tagline}_\n`;
        }
        modeList += `\n*Usage:* \`.aimode <mode> [level] [jid]\` (e.g. \`.aimode eli5 2\`)`;
        return sock.sendMessage(currentChatId, { text: modeList }, { quoted: message });
    }

    // 7. ENABLE / ALL-IN-ONE CONFIGURATION
    // Triggers when 'on', or a mode is provided, or a level is provided
    if (parsed.explicitAction === 'on' || parsed.parsedMode || parsed.parsedLevel) {
        config.enabled = true;

        // GROUP TARGET LOGIC
        if (targetIsGroup) {
            config.mode = 'gen-co';
            config.level = 3;
            await saveAiConfig(targetChatId, config);

            const targetDesc = isRemoteTarget ? ` for Group \`${targetChatId}\`` : ` for this Group`;
            let groupMsg = `✅ *AI Mode Activated${targetDesc}!*\n\n` +
                           `• *Mode:* Conversational (\`gen-co\`) [Group Policy]\n` +
                           `• *Depth Level:* Level 3 (Comprehensive)\n` +
                           `• *Trigger:* Mention me (@bot) or reply to any of my messages.\n` +
                           `• Powered by Conversational AI.`;

            if ((parsed.parsedMode && parsed.parsedMode !== 'gen-co') || (parsed.parsedLevel && parsed.parsedLevel !== 3)) {
                groupMsg += `\n\n_📌 Note: Group chats remain locked to Conversational Mode (\`gen-co\`) and Level 3. Persona styling applies to private direct messages._`;
            }

            return sock.sendMessage(currentChatId, { text: groupMsg }, { quoted: message });
        }

        // PRIVATE DM TARGET LOGIC
        if (parsed.parsedMode) {
            config.mode = parsed.parsedMode;
        }
        if (parsed.parsedLevel) {
            config.level = parsed.parsedLevel;
        }

        await saveAiConfig(targetChatId, config);

        const currentModeObj = MODES[config.mode] || MODES['gen-co'];
        const targetDesc = isRemoteTarget ? ` for \`${targetChatId}\`` : '';

        return sock.sendMessage(currentChatId, {
            text: `✅ *AI Mode Activated${targetDesc}!*\n\n` +
                  `• *Persona Mode:* *${currentModeObj.name}* (\`${currentModeObj.slug}\`)\n` +
                  `• *Category:* ${currentModeObj.category}\n` +
                  `• *Tagline:* _${currentModeObj.tagline}_\n` +
                  `• *Depth Level:* Level ${config.level} / 5\n\n` +
                  `*Direct Message Behavior:*\n` +
                  `• Automatically replies to all incoming text messages.\n` +
                  `• Sending media (photos, videos, stickers, voice notes) triggers witty roasts & humorous remarks!\n` +
                  `• Configure anytime via \`.aimode <mode> [level] [jid]\`.`
        }, { quoted: message });
    }

    // 8. HELP MENU (No args, help, or unrecognized input)
    let help = `*🤖 CONVERSATIONAL AI MODE*\n\n`;
    if (parsed.unrecognized.length > 0) {
        help += `⚠️ *Unknown command or mode:* "${parsed.unrecognized.join(' ')}"\n\n`;
    }
    help += `*Current Chat:* \`${currentChatId}\`\n` +
            `*Status:* ${config.enabled ? '✅ Active' : '❌ Inactive'}\n` +
            `*Active Mode:* ${MODES[config.mode]?.name || 'General Conversational'} (\`${config.mode}\`)\n` +
            `*Depth Level:* Level ${config.level} / 5\n\n` +
            `*Commands:*\n` +
            `• \`.aimode on [mode] [level] [jid]\` - Enable & configure AI mode\n` +
            `• \`.aimode off [jid]\` - Disable AI mode\n` +
            `• \`.aimode status [jid]\` - View status & settings\n` +
            `• \`.aimode reset [jid]\` - Reset settings & clear chat memory\n` +
            `• \`.aimode default 1 [jid]\` - Set default conversational mode & level 1\n` +
            `• \`.aimode <mode> [level] [jid]\` - Set persona mode & depth level\n` +
            `• \`.aimode level <1-5> [jid]\` - Adjust response depth level\n\n` +
            `*Admin & Owner JID Targeting:*\n` +
            `• Target any chat by phone number or JID:\n` +
            `  - \`.aimode default 1 254712345678\`\n` +
            `  - \`.aimode on tech 3 254712345678@s.whatsapp.net\`\n` +
            `  - \`.aimode eli5 2 120363025123456789@g.us\`\n` +
            `  - \`.aimode off 254712345678\`\n` +
            `  - \`.aimode status 120363025123456789@g.us\`\n\n` +
            `*🎭 Available Persona Modes (Private DMs):*\n` +
            `1. \`gen-co\` (or \`default\`, \`general\`) - Balanced daily assistant\n` +
            `2. \`gen-co-em\` (or \`emoji\`, \`fun\`) - Vibrant with emojis\n` +
            `3. \`prof-tech\` (or \`tech\`, \`pro\`) - Analytical engineering consultant\n` +
            `4. \`socratic\` (or \`guide\`, \`tutor\`) - Socratic mentor & guided reasoning\n` +
            `5. \`eli5\` (or \`simple\`, \`beginner\`) - Explain Like I'm 5 (analogies)\n` +
            `6. \`concise\` (or \`bullet\`, \`brief\`) - Zero fluff, maximum signal\n` +
            `7. \`code-mentor\` (or \`code\`, \`dev\`) - Software architect & code mentor\n` +
            `8. \`creative\` (or \`story\`, \`writer\`) - Imaginative prose & storytelling\n` +
            `9. \`zen\` (or \`peace\`, \`calm\`) - Mindful clarity, stillness & wisdom\n` +
            `10. \`medieval\` (or \`knight\`, \`royal\`) - Chivalric prose & archaic flair\n\n` +
            `*👥 Group Policy:*\n` +
            `• Group chats remain locked to Conversational Mode (\`gen-co\`).\n` +
            `• Responds only when explicitly mentioned (@bot) or replied to.\n` +
            `• Admins can toggle AI mode on/off or view status remotely via JID.`;

    return sock.sendMessage(currentChatId, { text: help }, { quoted: message });
}

module.exports = {
    command: 'chatbot',
    aliases: ['aimode', 'chatgpt', 'chatbots', 'autochat', 'achat'],
    category: 'ai',
    description: 'Toggle and configure Conversational AI mode for private DMs or group chats',
    usage: '.aimode [on|off|status|default 1|<mode> [level] [jid]]',

    handler,
    handleChatbotResponse,
    getAiConfig,
    saveAiConfig,
    callAiChat,
    callMistralChat: callAiChat,
    resolveTargetJid,
    parseAiModeArgs,
    MODES,
    MODE_ALIASES,
    DEPTH_LEVELS
};
