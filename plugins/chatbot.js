const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

const MISTRAL_API_URL = 'https://mistral-conversational.vercel.app/api/chat';
const SETTING_KEY = 'aimode';

// 8 Official Persona Modes from Mistral Conversational API (/docs)
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

    'gen-co-em': 'gen-co-em',
    'gencoem': 'gen-co-em',
    'emoji': 'gen-co-em',
    'emojis': 'gen-co-em',
    'fun': 'gen-co-em',

    'prof-tech': 'prof-tech',
    'proftech': 'prof-tech',
    'tech': 'prof-tech',
    'technical': 'prof-tech',
    'pro': 'prof-tech',
    'professional': 'prof-tech',
    'engineer': 'prof-tech',

    'socratic': 'socratic',
    'tutor': 'socratic',
    'guide': 'socratic',
    'inquiry': 'socratic',

    'eli5': 'eli5',
    'simple': 'eli5',
    'kid': 'eli5',
    'beginner': 'eli5',

    'concise': 'concise',
    'bullet': 'concise',
    'brief': 'concise',
    'short': 'concise',
    'fast': 'concise',

    'code-mentor': 'code-mentor',
    'codementor': 'code-mentor',
    'code': 'code-mentor',
    'coding': 'code-mentor',
    'developer': 'code-mentor',
    'dev': 'code-mentor',
    'program': 'code-mentor',

    'creative': 'creative',
    'story': 'creative',
    'storyteller': 'creative',
    'writer': 'creative',
    'artistic': 'creative'
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
                level: typeof data.level === 'number' ? data.level : 3
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
            level: typeof config.level === 'number' ? config.level : 3
        };
        await store.saveSetting(chatId, SETTING_KEY, toSave);
        return true;
    } catch (e) {
        console.error('[AI-MODE] Error saving config:', e.message);
        return false;
    }
}

/**
 * Calls Mistral Conversational API endpoint
 */
async function callMistralChat({ message, mode = 'gen-co', level = 3, history = [], systemPromptOverride = null }, retries = 1) {
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
        const response = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MEGA-MD-MistralAI/1.0'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error || `HTTP ${response.status} ${response.statusText}`;
            console.error('[AI-MODE] Mistral API error:', errMsg);
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
            console.error('[AI-MODE] Mistral API timed out after 35s');
            return { success: false, error: 'Request timed out' };
        }
        if (retries > 0) {
            console.warn(`[AI-MODE] Mistral API fetch failed (${err.message}). Retrying in 1s...`);
            await new Promise(r => setTimeout(r, 1000));
            return callMistralChat({ message, mode, level, history, systemPromptOverride }, retries - 1);
        }
        console.error('[AI-MODE] Mistral API call failed:', err.message);
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

            const result = await callMistralChat({
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
                const result = await callMistralChat({
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
            const result = await callMistralChat({
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
 * Command Handler (.aimode / .chatbot / .mistral / .chatgpt)
 */
async function handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    const isOwnerOrSudoCheck = !!(context.isOwnerOrSudoCheck || message.key.fromMe);

    const sub = (args[0] || '').toLowerCase().trim();
    const val = (args[1] || '').toLowerCase().trim();
    const config = await getAiConfig(chatId);

    // Identify if the requested action is mutating
    const isMutatingAction = ['on', 'enable', 'start', 'off', 'disable', 'stop', 'reset', 'level', 'mode', 'persona', 'tone', 'style', 'set'].includes(sub) ||
        !!MODE_ALIASES[sub];

    // Permission check for groups: Only admins or owner/sudo can mutate AI mode in groups
    if (isGroup && isMutatingAction && !isOwnerOrSudoCheck) {
        let isSenderAdmin = context.isSenderAdmin;
        if (typeof isSenderAdmin !== 'boolean') {
            try {
                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
            } catch {
                isSenderAdmin = false;
            }
        }
        if (!isSenderAdmin) {
            return sock.sendMessage(chatId, {
                text: '❌ *Permission Denied*: Only group admins or the bot owner can configure AI Mode for this group.'
            }, { quoted: message });
        }
    }

    // 1. ENABLE AI MODE
    if (sub === 'on' || sub === 'enable' || sub === 'start') {
        config.enabled = true;

        // If an optional mode alias is provided in DM (e.g. .aimode on eli5)
        if (!isGroup && val && MODE_ALIASES[val] && MODES[MODE_ALIASES[val]]) {
            config.mode = MODE_ALIASES[val];
        }

        await saveAiConfig(chatId, config);

        if (isGroup) {
            return sock.sendMessage(chatId, {
                text: `✅ *AI Mode Activated for this Group!*\n\n` +
                      `• *Mode:* Conversational (\`gen-co\`) [Group Policy]\n` +
                      `• *Trigger:* Mention me (@bot) or reply to any of my messages.\n` +
                      `• Powered by Mistral Conversational AI.`
            }, { quoted: message });
        } else {
            const currentModeObj = MODES[config.mode] || MODES['gen-co'];
            return sock.sendMessage(chatId, {
                text: `✅ *AI Mode Activated!*\n\n` +
                      `• *Persona Mode:* *${currentModeObj.name}* (\`${currentModeObj.slug}\`)\n` +
                      `• *Tagline:* _${currentModeObj.tagline}_\n` +
                      `• *Depth Level:* ${config.level} / 5\n\n` +
                      `*Direct Message Behavior:*\n` +
                      `• Automatically replies to all incoming text messages.\n` +
                      `• Sending media (photos, videos, stickers, voice notes) triggers witty roasts & humorous remarks!\n` +
                      `• Configure persona mode anytime via \`.aimode <mode>\`.`
            }, { quoted: message });
        }
    }

    // 2. DISABLE AI MODE
    if (sub === 'off' || sub === 'disable' || sub === 'stop') {
        config.enabled = false;
        await saveAiConfig(chatId, config);
        conversationHistory.delete(chatId);

        return sock.sendMessage(chatId, {
            text: `❌ *AI Mode Deactivated!*\n\n` +
                  (isGroup
                      ? `I will no longer reply to mentions or messages in this group.`
                      : `Automatic replies and media responses in this direct message are now paused.`)
        }, { quoted: message });
    }

    // 3. STATUS / INFO
    if (sub === 'status' || sub === 'info') {
        const modeObj = MODES[config.mode] || MODES['gen-co'];
        const statusIcon = config.enabled ? '✅ Enabled' : '❌ Disabled';
        const levelDesc = DEPTH_LEVELS[config.level] || DEPTH_LEVELS[3];

        let msgText = `*🤖 MISTRAL CONVERSATIONAL AI MODE*\n\n` +
                      `• *Status:* ${statusIcon}\n` +
                      `• *Chat Type:* ${isGroup ? 'Group Chat' : 'Private Direct Message'}\n` +
                      `• *Current Mode:* *${modeObj.name}* (\`${modeObj.slug}\`)\n` +
                      `• *Tagline:* _${modeObj.tagline}_\n` +
                      `• *Depth Level:* ${config.level} (${levelDesc})\n\n`;

        if (isGroup) {
            msgText += `*Group Policy:*\n` +
                       `Group chats are strictly locked to Conversational Mode (\`gen-co\`) and respond only when mentioned or replied to.`;
        } else {
            msgText += `*Private DM Customization:*\n` +
                       `Use \`.aimode <mode>\` to change persona style or \`.aimode level <1-5>\` to adjust depth.`;
        }

        return sock.sendMessage(chatId, { text: msgText }, { quoted: message });
    }

    // 4. RESET HISTORY & SETTINGS
    if (sub === 'reset') {
        config.mode = 'gen-co';
        config.level = 3;
        await saveAiConfig(chatId, config);
        conversationHistory.delete(chatId);

        return sock.sendMessage(chatId, {
            text: `🔄 *AI Mode Reset to Defaults!*\n\n` +
                  `• Mode reset to *General Conversational* (\`gen-co\`).\n` +
                  `• Depth level reset to Level 3 (Comprehensive).\n` +
                  `• Conversation memory cleared.`
        }, { quoted: message });
    }

    // 5. DEPTH LEVEL CONFIGURATION (.aimode level <1-5>)
    if (sub === 'level') {
        if (isGroup) {
            return sock.sendMessage(chatId, {
                text: `⚠️ *Group Restriction*: Group chats are strictly locked to default conversational settings. Depth level adjustment is available in private direct messages only.`
            }, { quoted: message });
        }

        const lvl = parseInt(val, 10);
        if (!lvl || lvl < 1 || lvl > 5) {
            let lvlList = `*Available Depth Levels (1 - 5):*\n\n`;
            for (let i = 1; i <= 5; i++) {
                lvlList += `• *Level ${i}*: ${DEPTH_LEVELS[i]}\n`;
            }
            lvlList += `\n*Usage:* \`.aimode level <1-5>\` (e.g. \`.aimode level 2\`)`;
            return sock.sendMessage(chatId, { text: lvlList }, { quoted: message });
        }

        config.level = lvl;
        await saveAiConfig(chatId, config);

        return sock.sendMessage(chatId, {
            text: `✅ *Depth Level Updated to Level ${lvl}!*\n\n${DEPTH_LEVELS[lvl]}`
        }, { quoted: message });
    }

    // 6. PERSONA MODE CONFIGURATION (.aimode mode <slug>, .aimode persona <slug>, .aimode tone <slug>, .aimode style <slug>, .aimode set <slug>, OR .aimode <slug>)
    const isModePrefix = ['mode', 'persona', 'tone', 'style', 'set'].includes(sub);
    const targetCandidate = (isModePrefix ? val : sub).toLowerCase();
    const resolvedSlug = MODE_ALIASES[targetCandidate];

    if (resolvedSlug && MODES[resolvedSlug]) {
        // Enforce group chat restriction
        if (isGroup) {
            return sock.sendMessage(chatId, {
                text: `⚠️ *Group Restriction*: Group chats are strictly restricted to *Conversational Mode* (\`gen-co\`).\n\n` +
                      `Persona mode configuration (such as \`${resolvedSlug}\`) is only available in private direct messages.`
            }, { quoted: message });
        }

        config.mode = resolvedSlug;
        const optionalLevelStr = isModePrefix ? args[2] : args[1];
        if (optionalLevelStr) {
            const optionalLevel = parseInt(optionalLevelStr, 10);
            if (optionalLevel >= 1 && optionalLevel <= 5) {
                config.level = optionalLevel;
            }
        }

        await saveAiConfig(chatId, config);
        const modeData = MODES[resolvedSlug];

        return sock.sendMessage(chatId, {
            text: `✅ *Persona Mode Updated!*\n\n` +
                  `• *Mode:* *${modeData.name}* (\`${modeData.slug}\`)\n` +
                  `• *Category:* ${modeData.category}\n` +
                  `• *Tagline:* _${modeData.tagline}_\n` +
                  `• *Depth Level:* Level ${config.level} / 5\n\n` +
                  `All subsequent private messages will use this persona style.`
        }, { quoted: message });
    }

    // 7. DEFAULT HELP MENU
    let help = `*🤖 MISTRAL CONVERSATIONAL AI MODE*\n\n` +
               `*Current Chat Status:* ${config.enabled ? '✅ Active' : '❌ Inactive'}\n` +
               `*Active Mode:* ${MODES[config.mode]?.name || 'General Conversational'} (\`${config.mode}\`)\n` +
               `*Depth Level:* ${config.level} / 5\n\n` +
               `*Commands:*\n` +
               `• \`.aimode on\` - Enable AI Mode for this chat\n` +
               `• \`.aimode off\` - Disable AI Mode for this chat\n` +
               `• \`.aimode status\` - View current status & settings\n` +
               `• \`.aimode reset\` - Reset settings and clear chat memory\n`;

    if (!isGroup) {
        help += `• \`.aimode <mode>\` - Switch persona mode (DMs only)\n` +
                `• \`.aimode level <1-5>\` - Adjust response depth level (DMs only)\n\n` +
                `*🎭 Available Persona Modes (Private DMs):*\n` +
                `1. \`gen-co\` (or \`general\`) - Balanced daily assistant\n` +
                `2. \`gen-co-em\` (or \`emoji\`) - Vibrant with emojis\n` +
                `3. \`prof-tech\` (or \`tech\`) - Analytical engineering consultant\n` +
                `4. \`socratic\` (or \`guide\`) - Socratic mentor & guided inquiry\n` +
                `5. \`eli5\` (or \`simple\`) - Explain Like I'm 5 (analogies)\n` +
                `6. \`concise\` (or \`bullet\`) - Zero fluff, maximum signal\n` +
                `7. \`code-mentor\` (or \`code\`) - Software architect & code mentor\n` +
                `8. \`creative\` (or \`story\`) - Imaginative prose & storytelling\n\n` +
                `*💡 Features in Private DMs:*\n` +
                `• Automatically responds to all incoming text.\n` +
                `• Incoming photos, stickers, audio, and documents trigger witty roasts!`;
    } else {
        help += `\n*👥 Group Chat Policy:*\n` +
                `• Restricted strictly to Conversational Mode (\`gen-co\`).\n` +
                `• Responds only when explicitly mentioned (@bot) or replied to.`;
    }

    return sock.sendMessage(chatId, { text: help }, { quoted: message });
}

module.exports = {
    command: 'chatbot',
    aliases: ['aimode', 'mistral', 'chatgpt', 'chatbots', 'autochat', 'achat'],
    category: 'ai',
    description: 'Toggle and configure Mistral Conversational AI mode for private DMs or group chats',
    usage: '.aimode <on|off|status|mode <slug>|level <1-5>|reset>',

    handler,
    handleChatbotResponse,
    getAiConfig,
    saveAiConfig,
    callMistralChat,
    MODES,
    MODE_ALIASES,
    DEPTH_LEVELS
};
