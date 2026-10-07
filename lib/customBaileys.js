'use strict';

/**
 * Custom Baileys Socket Enhancements & Monkey-Patch Layer
 * 
 * Features:
 * 1. Status Reaction Shield: Guarantees statusJidList: [participant, botJid] and blocks DM leak (kills "Waiting for this message").
 * 2. Native Interactive & Button Messages: Native flow buttons, list templates, and markdown tables.
 * 3. Complete Newsletter Engine: create, metadata, follow, unfollow, mute, unmute, subscribers, react.
 * 4. Resilient Presence & Keepalive: Prevents WebSocket congestion during alwaysOnline.
 * 5. Multi-Device JID/LID Resolution: Standardized participant identification.
 */

const {
    proto,
    generateWAMessageFromContent,
    generateMessageID,
    jidDecode,
    jidNormalizedUser,
    delay
} = require('@whiskeysockets/baileys');

// Outgoing Message Cache for Retry Resolution (Max 5000, 24h TTL)
const outgoingCache = new Map();
const OUTGOING_CACHE_MAX = 5000;
const OUTGOING_CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheOutgoingMessage(msgId, message, remoteJid) {
    if (!msgId || !message) return;
    // O(1) eviction of oldest entry when capacity is exceeded
    if (outgoingCache.size >= OUTGOING_CACHE_MAX) {
        const oldestKey = outgoingCache.keys().next().value;
        if (oldestKey) outgoingCache.delete(oldestKey);
    }
    outgoingCache.set(msgId, {
        message,
        remoteJid,
        timestamp: Date.now()
    });
}

// Background cleanup for expired cache items
const cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of outgoingCache.entries()) {
        if (now - entry.timestamp > OUTGOING_CACHE_TTL) {
            outgoingCache.delete(id);
        }
    }
}, 30 * 60 * 1000);
if (typeof cacheCleanupInterval.unref === 'function') {
    cacheCleanupInterval.unref();
}

// Official WhatsApp GraphQL Query IDs for w:mex queries (Newsletters)
const NEWSLETTER_QUERY_IDS = {
    CREATE: '6330026447039299',
    UPDATE_METADATA: '7150902998257522',
    SUBSCRIBERS: '6300870199982737',
    METADATA: '6620195908089573',
    FOLLOW: '7871414976211147',
    UNFOLLOW: '7238632346214362',
    MUTE: '251512824694272',
    UNMUTE: '7386057344737856',
    DELETE: '8316537688363079',
    ADMIN_COUNT: '7130823597031706',
    CHANGE_OWNER: '7341777602580933',
    DEMOTE: '6551828931592901'
};

/**
 * Execute a W:MEX GraphQL query over WhatsApp WebSocket IQ
 */
async function executeWMexQuery(sock, variables, queryId) {
    if (!sock || typeof sock.query !== 'function') {
        throw new Error('Socket does not support query method');
    }
    const messageTag = typeof sock.generateMessageTag === 'function'
        ? sock.generateMessageTag()
        : generateMessageID();

    const res = await sock.query({
        tag: 'iq',
        attrs: {
            id: messageTag,
            type: 'get',
            to: 's.whatsapp.net',
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    });

    if (res && res.content && Array.isArray(res.content)) {
        const resultChild = res.content.find(c => c && c.tag === 'result');
        if (resultChild && resultChild.content) {
            try {
                const parsed = JSON.parse(resultChild.content.toString());
                if (parsed.errors && parsed.errors.length > 0) {
                    throw new Error(parsed.errors.map(e => e.message || 'Unknown GraphQL error').join(', '));
                }
                return parsed.data || parsed;
            } catch (err) {
                if (err.message.includes('GraphQL') || err.message.includes('error')) {
                    throw err;
                }
                return resultChild.content;
            }
        }
    }
    return res;
}

/**
 * Build Native Flow Interactive Message Payload
 */
/**
 * Keith Baileys button builder helper:
 * btn.reply, btn.url, btn.copy, btn.call, btn.list, etc.
 */
const btn = {
    url(display_text, url, merchant_url) {
        return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text,
                url,
                merchant_url: merchant_url || url
            })
        };
    },
    copy(display_text, copy_code) {
        return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text,
                copy_code
            })
        };
    },
    call(display_text, phone_number) {
        return {
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({ display_text, phone_number })
        };
    },
    reply(display_text, id) {
        return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text, id })
        };
    },
    reminder(display_text, id) {
        return {
            name: 'cta_reminder',
            buttonParamsJson: JSON.stringify({ display_text, id })
        };
    },
    cancelReminder(display_text, id) {
        return {
            name: 'cta_cancel_reminder',
            buttonParamsJson: JSON.stringify({ display_text, id })
        };
    },
    address(display_text, id) {
        return {
            name: 'address_message',
            buttonParamsJson: JSON.stringify({ display_text, id })
        };
    },
    location(options = {}) {
        return {
            name: 'send_location',
            buttonParamsJson: JSON.stringify(options)
        };
    },
    list(list_button_text, sections) {
        return {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({ title: list_button_text, sections })
        };
    }
};

/**
 * Classic ButtonV2 Builder (buttonsMessage with headerType 6)
 * Compatible with WhatsApp clients that do not support or drop native flow buttons.
 */
class ButtonV2 {
    constructor(client, { generateWAMessageFromContent } = {}) {
        if (!client) throw new Error('ButtonV2 requires a WASocket');
        this._client = client;
        this._generateWAMessageFromContent = generateWAMessageFromContent || require('@whiskeysockets/baileys').generateWAMessageFromContent;
        this._title = '';
        this._subtitle = '';
        this._body = '';
        this._footer = '';
        this._contextInfo = {};
        this._extraPayload = {};
        this._buttons = [];
        this._image = undefined;
        this._data = undefined;
    }

    setTitle(title) { this._title = title || ''; return this; }
    setSubtitle(subtitle) { this._subtitle = subtitle || ''; return this; }
    setBody(body) { this._body = body || ''; return this; }
    setFooter(footer) { this._footer = footer || ''; return this; }
    setContextInfo(obj) { this._contextInfo = obj || {}; return this; }
    addPayload(obj) { Object.assign(this._extraPayload, obj || {}); return this; }

    addButton(displayText = '', buttonId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2))) {
        this._buttons.push({
            buttonId,
            buttonText: { displayText },
            type: 1
        });
        return this;
    }

    addRawButton(obj) {
        if (obj && typeof obj === 'object') this._buttons.push(obj);
        return this;
    }

    setThumbnail(path) {
        this._image = path;
        return this;
    }

    setMedia(obj) {
        this._data = obj;
        return this;
    }

    async setLocation(thumbnail, name = '', address = '') {
        this._title = name;
        this._subtitle = address;
        this._image = thumbnail;
        return this;
    }

    async build(jid, { mentions, ...options } = {}) {
        const contextInfo = { ...this._contextInfo };
        if (mentions?.length) contextInfo.mentionedJid = mentions;

        const thumbnailBuf = Buffer.isBuffer(this._image) ? this._image : null;

        const msg = this._generateWAMessageFromContent(
            jid,
            {
                ...this._extraPayload,
                buttonsMessage: {
                    contentText: this._body,
                    footerText: this._footer,
                    ...(this._data ? this._data : {
                        headerType: 6,
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0,
                            name: this._title,
                            address: this._subtitle,
                            jpegThumbnail: thumbnailBuf
                        }
                    }),
                    viewOnce: true,
                    contextInfo,
                    buttons: [...this._buttons]
                }
            },
            { ...options }
        );
        return msg;
    }

    async send(jid, { ...options } = {}) {
        if (this._buttons.length < 1) {
            throw new Error('ButtonV2 requires at least one button');
        }
        const msg = await this.build(jid, options);
        await this._client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [
                                { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
                            ]
                        }
                    ]
                }
            ],
            ...options
        });
        return msg;
    }

    async run(jid, sock, options = {}) {
        return this.send(jid, options);
    }
}

/**
 * Build Native Flow Interactive Message Payload
 * (Keith Baileys standard: direct interactiveMessage without viewOnce wrapping by default)
 */
function buildNativeFlowMessage({ text = '', footer = '', title = '', subtitle = '', buttons = [], contextInfo = {}, viewOnce = false }) {
    const formattedButtons = (buttons || []).map((btn, index) => {
        if (btn && btn.name && btn.buttonParamsJson) {
            return btn;
        }
        // Single select (Interactive List / Menu with Sections & Rows)
        if (btn.type === 'single_select' || btn.type === 'list' || btn.name === 'single_select' || btn.sections) {
            return {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: btn.title || btn.text || btn.display_text || 'Choose Option',
                    sections: btn.sections || []
                })
            };
        }
        if (btn.type === 'url' || btn.url) {
            return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || btn.display_text || 'Open Link',
                    url: btn.url,
                    merchant_url: btn.merchant_url || btn.url
                })
            };
        }
        if (btn.type === 'copy' || btn.copy_code || btn.code) {
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || btn.display_text || 'Copy Code',
                    copy_code: btn.copy_code || btn.code || btn.display_text || ''
                })
            };
        }
        if (btn.type === 'call' || btn.phone_number) {
            return {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || btn.display_text || 'Call',
                    phone_number: btn.phone_number
                })
            };
        }
        // Default quick reply button
        return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: btn.text || btn.display_text || `Option ${index + 1}`,
                id: btn.id || btn.command || `${index + 1}`
            })
        };
    });

    const interactiveMessage = {
        body: text ? { text } : undefined,
        footer: footer ? { text: footer } : undefined,
        header: (title || subtitle) ? {
            title: title || '',
            subtitle: subtitle || undefined,
            hasMediaAttachment: false
        } : undefined,
        nativeFlowMessage: {
            buttons: formattedButtons,
            messageParamsJson: ''
        },
        contextInfo: contextInfo || {}
    };

    if (viewOnce) {
        return {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage
                }
            }
        };
    }

    return { interactiveMessage };
}

/**
 * Extra stanza nodes WhatsApp requires for native-flow (interactive) buttons to render.
 * Without the <biz> node the server/app silently drops or hides the buttons.
 * Omits the <bot biz_bot="1"/> tag so buttons render cleanly without the Meta AI badge (matching ButtonV2).
 */
function getButtonAdditionalNodes(jid = '') {
    return [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }];
}

/**
 * Send native-flow buttons the way working forks do:
 * direct interactiveMessage + valid message id + <biz>/<bot> nodes.
 */
async function sendNativeFlowButtons(sock, jid, opts = {}, quoted) {
    const wrapped = buildNativeFlowMessage(opts);
    const genOpts = { userJid: sock.user?.id };
    if (quoted && quoted.key) genOpts.quoted = quoted;
    const waMsg = generateWAMessageFromContent(jid, wrapped, genOpts);
    await sock.relayMessage(jid, waMsg.message, {
        messageId: waMsg.key.id,
        additionalNodes: getButtonAdditionalNodes(jid)
    });
    return waMsg;
}

/**
 * Patches a Baileys WASocket instance with custom capabilities and safety guards.
 * @param {import('@whiskeysockets/baileys').WASocket} sock 
 * @param {object} options 
 */
function patchBaileysSocket(sock, options = {}) {
    if (!sock) return sock;
    if (sock._isCustomPatched) return sock;
    sock._isCustomPatched = true;

    const store = options.store;
    const richMessages = require('./richMessages');
    sock.richMessages = richMessages;

    // 1. Standardized decodeJid method
    const originalDecodeJid = sock.decodeJid;
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (jid === 'status@broadcast') return jid;
        if (jid.endsWith('@newsletter')) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return (decode.user && decode.server) ? `${decode.user}@${decode.server}` : jid;
        }
        if (typeof originalDecodeJid === 'function') {
            return originalDecodeJid(jid);
        }
        return jid;
    };

    // 1b. Intercept query to gracefully absorb passive IQ and ping query timeouts
    const originalQuery = sock.query;
    if (typeof originalQuery === 'function') {
        sock.query = async function(node, timeoutMs) {
            const isPassiveOrPing = node && (
                (node.tag === 'iq' && node.attrs?.xmlns === 'passive') ||
                (node.tag === 'iq' && node.attrs?.xmlns === 'w:p')
            );

            if (isPassiveOrPing) {
                try {
                    return await originalQuery.call(this, node, timeoutMs);
                } catch (err) {
                    const isTimeout = err?.output?.statusCode === 408 || String(err?.message || '').toLowerCase().includes('timed out');
                    if (isTimeout) {
                        return undefined;
                    }
                    throw err;
                }
            }
            return await originalQuery.call(this, node, timeoutMs);
        };
    }

    // 2. Intercept sendMessage
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async function(jid, content, sendOptions = {}) {
        // --- A. Status Reaction & DM Spillover Guard ---
        if (content && content.react) {
            const reactKey = content.react.key;
            if (reactKey && reactKey.remoteJid === 'status@broadcast') {
                // A status reaction MUST NEVER be sent to a user's private DM
                // Force recipient to status@broadcast
                jid = 'status@broadcast';

                const targetSet = new Set();
                // Prefer participantPn (phone JID) over participant (may be @lid)
                const participant = reactKey.participantPn || reactKey.participant;
                if (participant && participant !== 'status@broadcast') {
                    targetSet.add(sock.decodeJid(participant));
                }
                // Also add raw participant if it's a phone JID
                if (reactKey.participant && reactKey.participant.includes('@s.whatsapp.net')) {
                    targetSet.add(sock.decodeJid(reactKey.participant));
                }
                if (sock.user?.id) {
                    targetSet.add(sock.decodeJid(sock.user.id));
                }
                if (Array.isArray(sendOptions.statusJidList)) {
                    sendOptions.statusJidList.forEach(item => {
                        if (item && item !== 'status@broadcast') {
                            targetSet.add(sock.decodeJid(item));
                        }
                    });
                }

                sendOptions.statusJidList = Array.from(targetSet).filter(Boolean);
            }
        }

        // --- B. Button / Native Flow Messages Shorthand ---
        if (content && (content.buttons || content.nativeFlowButtons)) {
            const buttons = content.buttons || content.nativeFlowButtons;
            const buttonPayload = buildNativeFlowMessage({
                text: content.text || content.caption || '',
                footer: content.footer || '',
                title: content.title || '',
                buttons,
                contextInfo: content.contextInfo || {}
            });
            void buttonPayload;
            return await sendNativeFlowButtons(this, jid, {
                text: content.text || content.caption || '',
                footer: content.footer || '',
                title: content.title || '',
                subtitle: content.subtitle || '',
                buttons,
                contextInfo: content.contextInfo || {}
            }, sendOptions.quoted);
        }

        const result = await originalSendMessage.call(this, jid, content, sendOptions);
        if (result?.key?.id && result?.message) {
            cacheOutgoingMessage(result.key.id, result.message, result.key.remoteJid || jid);
            if (store && typeof store.saveMessage === 'function') {
                store.saveMessage(result).catch(() => {});
            }
        }
        return result;
    };

    // 3. Intercept relayMessage
    const originalRelayMessage = sock.relayMessage;
    sock.relayMessage = async function(jid, message, relayOptions = {}) {
        // Safeguard reaction messages referencing status@broadcast
        if (message?.reactionMessage?.key?.remoteJid === 'status@broadcast') {
            jid = 'status@broadcast';
            const targetSet = new Set();
            const participant = message.reactionMessage.key.participant || message.reactionMessage.key.participantPn;
            if (participant && participant !== 'status@broadcast') {
                targetSet.add(sock.decodeJid(participant));
            }
            if (sock.user?.id) {
                targetSet.add(sock.decodeJid(sock.user.id));
            }
            if (Array.isArray(relayOptions.statusJidList)) {
                relayOptions.statusJidList.forEach(item => {
                    if (item && item !== 'status@broadcast') {
                        targetSet.add(sock.decodeJid(item));
                    }
                });
            }
            relayOptions.statusJidList = Array.from(targetSet).filter(Boolean);
        }

        const result = await originalRelayMessage.call(this, jid, message, relayOptions);
        const msgId = relayOptions.messageId || (typeof result === 'string' ? result : null);
        if (msgId && message) {
            const rawMsg = message?.message || message;
            cacheOutgoingMessage(msgId, rawMsg, jid);
            if (store && typeof store.saveMessage === 'function') {
                store.saveMessage({
                    key: {
                        remoteJid: jid,
                        fromMe: true,
                        id: msgId
                    },
                    message: rawMsg,
                    messageTimestamp: Math.floor(Date.now() / 1000)
                }).catch(() => {});
            }
        }
        return result;
    };

    function toProtoMessage(raw) {
        if (!raw || typeof raw !== 'object') return undefined;
        const inner = raw.message || raw;
        let protoMsg;
        try {
            if (inner.text && !inner.conversation && !inner.extendedTextMessage) {
                protoMsg = proto.Message.fromObject({ conversation: inner.text });
            } else {
                protoMsg = proto.Message.fromObject(inner);
            }
        } catch {
            protoMsg = inner;
        }
        if (!protoMsg || typeof protoMsg !== 'object') return undefined;
        if (Object.keys(protoMsg).length === 0) return undefined;
        return protoMsg;
    }

    // 4. Multi-Tier getMessage for Retry Resolution
    sock.getMessage = async function(key) {
        if (!key || !key.id) return undefined;
        const id = key.id;
        const jid = key.remoteJid;

        // Tier 1: outgoingCache (fast in-memory)
        if (outgoingCache.has(id)) {
            const cached = outgoingCache.get(id);
            if (cached && (Date.now() - cached.timestamp <= OUTGOING_CACHE_TTL)) {
                const protoMsg = toProtoMessage(cached.message);
                if (protoMsg) return protoMsg;
            } else if (cached) {
                outgoingCache.delete(id);
            }
        }

        // Tier 2: sock.messageRetryManager?.getRecentMessage(key.remoteJid, id)
        if (sock.messageRetryManager && typeof sock.messageRetryManager.getRecentMessage === 'function') {
            try {
                const recent = await sock.messageRetryManager.getRecentMessage(jid, id);
                const protoMsg = toProtoMessage(recent);
                if (protoMsg) return protoMsg;
            } catch {}
        }

        // Tier 3: store.loadMessage with @lid <-> @s.whatsapp.net cross-lookup fallback
        if (store && typeof store.loadMessage === 'function') {
            try {
                let loaded = await store.loadMessage(jid, id);
                if (!loaded && jid) {
                    // Try alternate JID via Baileys Signal repository lidMapping
                    let altJid = null;
                    if (sock.signalRepository?.lidMapping) {
                        try {
                            if (jid.endsWith('@s.whatsapp.net')) {
                                altJid = await sock.signalRepository.lidMapping.getLIDForPN(jid);
                            } else if (jid.endsWith('@lid')) {
                                altJid = await sock.signalRepository.lidMapping.getPNForLID(jid);
                            }
                        } catch {}
                    }
                    if (altJid) {
                        loaded = await store.loadMessage(altJid, id);
                    }

                    // Try participant fallback
                    if (!loaded && key.participant) {
                        loaded = await store.loadMessage(key.participant, id);
                    }

                    // Try store.contacts cross-lookup
                    if (!loaded && store.contacts) {
                        if (jid.endsWith('@lid')) {
                            const matchKey = Object.keys(store.contacts).find(k =>
                                k.endsWith('@s.whatsapp.net') && (store.contacts[k]?.lid === jid || store.contacts[jid]?.id === k || store.contacts[jid]?.pn === k)
                            );
                            if (matchKey) {
                                loaded = await store.loadMessage(matchKey, id);
                            }
                        } else if (jid.endsWith('@s.whatsapp.net')) {
                            const matchKey = Object.keys(store.contacts).find(k =>
                                k.endsWith('@lid') && (store.contacts[k]?.id === jid || store.contacts[k]?.pn === jid || store.contacts[jid]?.lid === k)
                            );
                            if (matchKey) {
                                loaded = await store.loadMessage(matchKey, id);
                            }
                        }
                    }
                }

                if (loaded) {
                    const protoMsg = toProtoMessage(loaded);
                    if (protoMsg) return protoMsg;
                }
            } catch (err) {}
        }

        // Crucial: return undefined (never "" or {}) when missing so Baileys knows it is unavailable
        return undefined;
    };

    // 5. Native Helpers for Buttons & Keith MD Rich Messages
    sock.btn = btn;
    sock.ButtonV2 = ButtonV2;

    sock.sendButtons = async function(jid, { text, footer, title, subtitle, buttons, contextInfo, viewOnce }, quoted) {
        return await sendNativeFlowButtons(this, jid, { text, footer, title, subtitle, buttons, contextInfo, viewOnce }, quoted);
    };

    sock.sendButtonV2 = async function(jid, options = {}, quoted) {
        const builder = new ButtonV2(this, { generateWAMessageFromContent });
        if (options.text || options.body) builder.setBody(options.text || options.body);
        if (options.footer) builder.setFooter(options.footer);
        if (options.title) builder.setTitle(options.title);
        if (options.subtitle) builder.setSubtitle(options.subtitle);
        if (options.contextInfo) builder.setContextInfo(options.contextInfo);
        if (options.thumbnail) builder.setThumbnail(options.thumbnail);
        const buttons = options.buttons || [];
        for (const b of buttons) {
            if (typeof b === 'string') {
                builder.addButton(b);
            } else if (b && (b.displayText || b.text)) {
                builder.addButton(b.displayText || b.text, b.buttonId || b.id);
            } else if (b) {
                builder.addRawButton(b);
            }
        }
        return await builder.send(jid, { quoted });
    };

    /**
     * Send rich AI-response table (compatible with both signature styles:
     * sock.sendTable(jid, title, headers, rows, quoted, options) and
     * sock.sendTable(jid, { title, headers, rows }, quoted))
     */
    sock.sendTable = async function(jid, title, headers, rows, quoted, options = {}) {
        if (title && typeof title === 'object' && !Array.isArray(title)) {
            const tableObj = title;
            return await this.sendTableV2(jid, tableObj, headers || quoted, rows || options);
        }
        const { message, messageId } = richMessages.generateTableContent(title, headers, rows, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendTableV2 = async function(jid, table, quoted, options = {}) {
        const { message, messageId } = richMessages.generateTableContentV2(table, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendList = async function(jid, title, items, quoted, options = {}) {
        const { message, messageId } = richMessages.generateListContent(title, items, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendCodeBlock = async function(jid, code, quoted, options = {}) {
        const { message, messageId } = richMessages.generateCodeBlockContent(code, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendCodeBlockV2 = async function(jid, code, quoted, options = {}) {
        const { message, messageId } = richMessages.generateCodeBlockContentV2(code, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendLink = async function(jid, text, links, quoted, options = {}) {
        const { message, messageId } = richMessages.generateLinkContent(text, links, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendLinkV2 = async function(jid, text, links, quoted, options = {}) {
        const { message, messageId } = richMessages.generateLinkContentV2(text, links, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendLatex = async function(jid, quoted, options = {}) {
        const { message, messageId } = richMessages.generateLatexContent(quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendLatexImage = async function(jid, quoted, options, renderLatexToPng, uploadFn) {
        const upload = uploadFn || this.waUploadToServer;
        const { message, messageId } = await richMessages.generateLatexImageContent(quoted, options, upload, renderLatexToPng);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendLatexInlineImage = async function(jid, quoted, options, renderLatexToPng, uploadFn) {
        const upload = uploadFn || this.waUploadToServer;
        const { message, messageId } = await richMessages.generateLatexInlineImageContent(quoted, options, upload, renderLatexToPng);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.captureUnifiedResponse = richMessages.captureUnifiedResponse;

    sock.sendUnifiedResponse = async function(jid, quoted, captured) {
        const { message, messageId } = richMessages.generateUnifiedResponseContent(quoted, captured);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    sock.sendRichMessage = async function(jid, submessages, quoted, options = {}) {
        const { message, messageId } = richMessages.generateRichMessageContent(submessages, quoted, options);
        await this.relayMessage(jid, message, { messageId });
        return { message, messageId };
    };

    // 5. Complete Newsletter Engine
    sock.newsletterCreate = async function(name, description = '') {
        return await executeWMexQuery(this, {
            input: { name, description: description || null }
        }, NEWSLETTER_QUERY_IDS.CREATE);
    };

    sock.newsletterMetadata = async function(type = 'JID', key) {
        return await executeWMexQuery(this, {
            fetch_creation_time: true,
            fetch_full_image: true,
            fetch_viewer_metadata: true,
            input: { key, type: String(type).toUpperCase() }
        }, NEWSLETTER_QUERY_IDS.METADATA);
    };

    sock.newsletterFollow = async function(jid) {
        const messageTag = typeof this.generateMessageTag === 'function'
            ? this.generateMessageTag()
            : generateMessageID();
        return await this.query({
            tag: 'iq',
            attrs: {
                id: messageTag,
                type: 'get',
                xmlns: 'w:mex',
                to: 's.whatsapp.net',
            },
            content: [
                {
                    tag: 'query',
                    attrs: { query_id: NEWSLETTER_QUERY_IDS.FOLLOW },
                    content: Buffer.from(JSON.stringify({ variables: { newsletter_id: jid } }))
                }
            ]
        });
    };

    sock.newsletterUnfollow = async function(jid) {
        return await executeWMexQuery(this, { newsletter_id: jid }, NEWSLETTER_QUERY_IDS.UNFOLLOW);
    };

    sock.newsletterMute = async function(jid) {
        return await executeWMexQuery(this, { newsletter_id: jid }, NEWSLETTER_QUERY_IDS.MUTE);
    };

    sock.newsletterUnmute = async function(jid) {
        return await executeWMexQuery(this, { newsletter_id: jid }, NEWSLETTER_QUERY_IDS.UNMUTE);
    };

    sock.newsletterSubscribers = async function(jid) {
        return await executeWMexQuery(this, { newsletter_id: jid }, NEWSLETTER_QUERY_IDS.SUBSCRIBERS);
    };

    sock.newsletterReactMessage = async function(jid, serverId, reaction) {
        const messageTag = typeof this.generateMessageTag === 'function'
            ? this.generateMessageTag()
            : generateMessageID();
        return await this.query({
            tag: 'message',
            attrs: {
                to: jid,
                ...(reaction ? {} : { edit: '7' }),
                type: 'reaction',
                server_id: String(serverId),
                id: messageTag
            },
            content: [
                {
                    tag: 'reaction',
                    attrs: reaction ? { code: reaction } : {}
                }
            ]
        });
    };

    // 6. Safe Presence Handling
    const originalSendPresenceUpdate = sock.sendPresenceUpdate;
    sock.sendPresenceUpdate = async function(...args) {
        if (!this.ws || this.ws.readyState !== 1) return;
        try {
            const ghostMode = store ? await store.getSetting('global', 'stealthMode') : null;
            if (ghostMode && ghostMode.enabled) return;

            return await originalSendPresenceUpdate.apply(this, args);
        } catch {}
    };

    // 8. Active Socket & Presence Keepalive Engine with Deadman Switch
    let keepAliveTimer = null;
    sock.startKeepAlive = function(intervalMs = 25000) {
        if (keepAliveTimer) clearInterval(keepAliveTimer);

        // Ensure underlying TLS socket has TCP keepalive enabled (15s probe)
        if (sock.ws?._socket?.setKeepAlive) {
            try { sock.ws._socket.setKeepAlive(true, 15000); } catch (_) {}
        }

        // Attach frame-level activity tracker if not already attached
        if (!sock._activityHooked) {
            sock._activityHooked = true;
            sock._lastActivity = Date.now();
            const recordActivity = () => { sock._lastActivity = Date.now(); };

            if (sock.ws && typeof sock.ws.on === 'function') {
                sock.ws.on('message', recordActivity);
                sock.ws.on('ping', recordActivity);
                sock.ws.on('pong', recordActivity);
            }
            if (sock.ev && typeof sock.ev.on === 'function') {
                sock.ev.on('messages.upsert', recordActivity);
                sock.ev.on('messages.update', recordActivity);
                sock.ev.on('presence.update', recordActivity);
                sock.ev.on('connection.update', (u) => {
                    recordActivity();
                    if (u?.connection === 'open' && sock.ws?._socket?.setKeepAlive) {
                        try { sock.ws._socket.setKeepAlive(true, 15000); } catch (_) {}
                    }
                });
            }
        }

        let lastPresenceUpdate = 0;
        keepAliveTimer = setInterval(async () => {
            try {
                if (!sock.ws || sock.ws.readyState !== 1) return;

                const now = Date.now();
                const silenceMs = now - (sock._lastActivity || now);

                // Deadman Switch: If 90 seconds pass with zero incoming frames despite Baileys pinging,
                // the connection is a half-open zombie socket dropped by cloud/NAT firewalls.
                // Terminate immediately so Baileys can re-establish a fresh TCP stream.
                if (silenceMs > 90000) {
                    console.warn(`[KEEPALIVE] ⚠️ Half-open socket detected (silence: ${Math.round(silenceMs / 1000)}s). Terminating zombie connection to trigger instant reconnect...`);
                    if (typeof sock.ws.terminate === 'function') {
                        sock.ws.terminate();
                    } else if (typeof sock.ws.close === 'function') {
                        sock.ws.close();
                    }
                    return;
                }

                // A. Application-level XMPP probe ping: only send if connection is quiet (>45s silence).
                // Baileys natively pings every 30s. We avoid flooding duplicate pings while ensuring NAT hole punching.
                if (silenceMs > 45000 && typeof sock.query === 'function') {
                    const tag = typeof sock.generateMessageTag === 'function' ? sock.generateMessageTag() : `${Date.now()}`;
                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            id: tag,
                            type: 'get',
                            xmlns: 'w:p',
                            to: 's.whatsapp.net'
                        },
                        content: [{ tag: 'ping', attrs: {} }]
                    }).catch(() => {});
                }

                // B. Companion device presence refresh: throttled to at most once per 60s
                if (now - lastPresenceUpdate > 60000) {
                    lastPresenceUpdate = now;
                    const ghostMode = store ? await store.getSetting('global', 'stealthMode').catch(() => null) : null;
                    if (!ghostMode || !ghostMode.enabled) {
                        await sock.sendPresenceUpdate('available').catch(() => {});
                    }
                }
            } catch {}
        }, intervalMs);

        // Keep timer referenced in Node.js event loop: prevents container schedulers (Koyeb/Render) from freezing/sleeping vCPU
        sock._keepAliveTimer = keepAliveTimer;
        return keepAliveTimer;
    };

    sock.stopKeepAlive = function() {
        if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
        }
        if (sock._keepAliveTimer) {
            clearInterval(sock._keepAliveTimer);
            sock._keepAliveTimer = null;
        }
    };

    // 9. Proactive Pre-Key Maintenance Engine
    let preKeyMaintenanceTimer = null;
    sock.startPreKeyMaintenance = function(intervalMs = 30 * 60 * 1000) {
        if (preKeyMaintenanceTimer) clearInterval(preKeyMaintenanceTimer);

        const checkAndUpload = async () => {
            try {
                if (!sock.ws || sock.ws.readyState !== 1) return;
                if (typeof sock.uploadPreKeysToServerIfRequired === 'function') {
                    await sock.uploadPreKeysToServerIfRequired();
                }
            } catch (err) {}
        };

        // Run check after initial delay (10s), then periodically
        setTimeout(checkAndUpload, 10000);

        preKeyMaintenanceTimer = setInterval(checkAndUpload, intervalMs);
        if (typeof preKeyMaintenanceTimer.unref === 'function') {
            preKeyMaintenanceTimer.unref();
        }
        sock._preKeyMaintenanceTimer = preKeyMaintenanceTimer;
        return preKeyMaintenanceTimer;
    };

    sock.stopPreKeyMaintenance = function() {
        if (preKeyMaintenanceTimer) {
            clearInterval(preKeyMaintenanceTimer);
            preKeyMaintenanceTimer = null;
        }
        if (sock._preKeyMaintenanceTimer) {
            clearInterval(sock._preKeyMaintenanceTimer);
            sock._preKeyMaintenanceTimer = null;
        }
    };

    // 10. Self-Repair Session Ratchet (Heal desynced/corrupt sessions)
    sock.healSession = async function(jid) {
        if (!jid) return false;
        try {
            const cleanJid = sock.decodeJid(jid);
            const userJid = cleanJid.includes('@') ? cleanJid : `${cleanJid}@s.whatsapp.net`;
            const user = userJid.split('@')[0].split(':')[0];

            if (sock.authState?.keys?.set) {
                const sessionDeletion = { session: {} };

                // Delete primary and companion device protocol address sessions (e.g. 2348012345678.0 .. .10)
                for (let d = 0; d <= 10; d++) {
                    sessionDeletion.session[`${user}.${d}`] = null;
                    sessionDeletion.session[`${user}_1.${d}`] = null;
                }

                // Delete direct JID entries
                sessionDeletion.session[userJid] = null;
                sessionDeletion.session[cleanJid] = null;
                sessionDeletion.session[`${user}@s.whatsapp.net`] = null;
                sessionDeletion.session[`${user}:0@s.whatsapp.net`] = null;

                // If Signal repository provides protocol address conversion, delete that too
                if (sock.signalRepository?.jidToSignalProtocolAddress) {
                    try {
                        const addr = sock.signalRepository.jidToSignalProtocolAddress(cleanJid);
                        if (addr) sessionDeletion.session[addr.toString()] = null;
                    } catch {}
                }

                // If LID mapping exists, purge linked LID session keys as well
                if (sock.signalRepository?.lidMapping) {
                    try {
                        let linkedJid = null;
                        if (cleanJid.endsWith('@s.whatsapp.net')) {
                            linkedJid = await sock.signalRepository.lidMapping.getLIDForPN(cleanJid);
                        } else if (cleanJid.endsWith('@lid')) {
                            linkedJid = await sock.signalRepository.lidMapping.getPNForLID(cleanJid);
                        }
                        if (linkedJid) {
                            const linkedUser = linkedJid.split('@')[0].split(':')[0];
                            for (let d = 0; d <= 10; d++) {
                                sessionDeletion.session[`${linkedUser}.${d}`] = null;
                                sessionDeletion.session[`${linkedUser}_1.${d}`] = null;
                            }
                        }
                    } catch {}
                }

                // If group, clear sender-key-memory
                if (cleanJid.endsWith('@g.us')) {
                    sessionDeletion['sender-key-memory'] = { [cleanJid]: null };
                }

                await sock.authState.keys.set(sessionDeletion);
            }

            // Clear retry counter cache
            if (sock.msgRetryCounterCache?.del) {
                const keys = sock.msgRetryCounterCache.keys() || [];
                for (const k of keys) {
                    if (k.includes(user) || k.includes(userJid) || k.includes(cleanJid)) {
                        sock.msgRetryCounterCache.del(k);
                    }
                }
            }

            // Clear placeholder resend cache
            if (sock.placeholderResendCache?.del) {
                const keys = sock.placeholderResendCache.keys() || [];
                for (const k of keys) {
                    if (k.includes(user) || k.includes(userJid) || k.includes(cleanJid)) {
                        sock.placeholderResendCache.del(k);
                    }
                }
            }

            console.log(`[SESSION-HEAL] Repaired session ratchet for ${cleanJid}`);
            return true;
        } catch (err) {
            console.error(`[SESSION-HEAL] Failed to heal session for ${jid}:`, err.message);
            return false;
        }
    };

    return sock;
}

module.exports = {
    patchBaileysSocket,
    buildNativeFlowMessage,
    getButtonAdditionalNodes,
    sendNativeFlowButtons,
    executeWMexQuery,
    NEWSLETTER_QUERY_IDS,
    richMessages: require('./richMessages')
};
