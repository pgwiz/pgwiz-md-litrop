const store = require('../lib/lightweight_store');

let autoClearTimer = null;

function parseDuration(input) {
    if (!input) return null;
    const match = String(input).trim().match(/^(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours|d|day|days)$/i);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('m')) return val * 60 * 1000;
    if (unit.startsWith('h')) return val * 60 * 60 * 1000;
    if (unit.startsWith('d')) return val * 24 * 60 * 60 * 1000;
    return null;
}

function formatDuration(ms) {
    if (!ms) return '24h';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours >= 24 && hours % 24 === 0) return (hours / 24) + 'd';
    if (hours >= 1) return hours + 'h';
    const mins = Math.floor(ms / (1000 * 60));
    return mins + 'm';
}

async function getAutoClearConfig() {
    try {
        const cfg = await store.getSetting('global', 'autoClearConfig');
        return (cfg && typeof cfg === 'object') ? cfg : {};
    } catch {
        return {};
    }
}

async function saveAutoClearConfig(cfg) {
    try {
        await store.saveSetting('global', 'autoClearConfig', cfg);
    } catch (err) {
        console.error('[AUTOCLEAR] Failed to save config:', err.message);
    }
}

async function runAutoClearCheck(sock) {
    if (!sock) return;
    try {
        const config = await getAutoClearConfig();
        const now = Date.now();
        let changed = false;

        for (const [chatId, data] of Object.entries(config)) {
            if (!data || !data.enabled) continue;
            const interval = data.intervalMs || 24 * 60 * 60 * 1000;
            const lastCleared = data.lastClearedAt || 0;

            if (now - lastCleared >= interval) {
                console.log("[AUTOCLEAR] Running scheduled clear for " + chatId + " (interval: " + (data.intervalLabel || '24h') + ")...");
                
                try {
                    const nowTs = Math.floor(now / 1000);
                    const dummyMsg = {
                        key: {
                            id: '0',
                            remoteJid: chatId,
                            fromMe: true
                        },
                        messageTimestamp: nowTs
                    };

                    await sock.chatModify({
                        clear: true,
                        lastMessages: [dummyMsg]
                    }, chatId).catch(async () => {
                        await sock.chatModify({
                            delete: true,
                            lastMessages: [dummyMsg]
                        }, chatId).catch(() => {});
                    });

                    if (store && typeof store.deleteChat === 'function') {
                        await store.deleteChat(chatId).catch(() => {});
                    }

                    data.lastClearedAt = now;
                    changed = true;
                    console.log("✅ [AUTOCLEAR] Cleared " + chatId + " successfully!");
                } catch (e) {
                    console.error("❌ [AUTOCLEAR] Error clearing " + chatId + ":", e.message);
                }
            }
        }

        if (changed) {
            await saveAutoClearConfig(config);
        }
    } catch (err) {
        console.error('[AUTOCLEAR] Error in auto-clear runner:', err.message);
    }
}

function initAutoClear(sock) {
    if (autoClearTimer) clearInterval(autoClearTimer);
    // Check every 2 minutes for scheduled chat clears
    autoClearTimer = setInterval(() => runAutoClearCheck(sock), 2 * 60 * 1000);
    console.log('✅ Auto-clear scheduler initialized (2-minute check interval)');
}

module.exports = {
    command: 'autoclear',
    aliases: ['autoclean', 'cleartimer', 'autoclearchat'],
    category: 'owner',
    description: 'Set automatic periodic chat clearing on a group or DM (e.g. .autoclear on, .autoclear set 12h)',
    usage: '.autoclear <on|off|set <time>|status|list>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const isGroup = chatId.endsWith('@g.us');
        const chatType = isGroup ? 'Group' : 'DM';

        try {
            const sub = (args[0] || '').toLowerCase().trim();
            const config = await getAutoClearConfig();
            const currentChatCfg = config[chatId] || { enabled: false, intervalMs: 24 * 60 * 60 * 1000, intervalLabel: '24h', lastClearedAt: 0 };

            if (!sub || sub === 'status') {
                const isEnabled = !!currentChatCfg.enabled;
                const interval = currentChatCfg.intervalLabel || formatDuration(currentChatCfg.intervalMs);
                let lastClearedStr = 'Never';
                let nextClearStr = 'N/A';

                if (currentChatCfg.lastClearedAt) {
                    lastClearedStr = new Date(currentChatCfg.lastClearedAt).toLocaleString();
                    const nextTime = currentChatCfg.lastClearedAt + (currentChatCfg.intervalMs || 24 * 60 * 60 * 1000);
                    nextClearStr = new Date(nextTime).toLocaleString();
                }

                const statusText = "*🧹 AUTO-CLEAR STATUS (" + chatType + ")*\n\n" +
                    "• *Status:* " + (isEnabled ? '✅ Enabled' : '❌ Disabled') + "\n" +
                    "• *Interval:* " + interval + "\n" +
                    "• *Last Cleared:* " + lastClearedStr + "\n" +
                    "• *Next Scheduled:* " + (isEnabled ? nextClearStr : 'Disabled') + "\n\n" +
                    "*Commands:*\n" +
                    "• `.autoclear on` - Enable auto-clear (default 24h)\n" +
                    "• `.autoclear off` - Disable auto-clear\n" +
                    "• `.autoclear set 6h` - Set custom interval (e.g. 1h, 6h, 12h, 24h, 3d, 7d)\n" +
                    "• `.autoclear list` - View all auto-cleared chats\n" +
                    "• `.clear` - Clear this chat immediately";

                await sock.sendMessage(chatId, {
                    text: statusText,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (sub === 'on' || sub === 'enable' || sub === 'true') {
                currentChatCfg.enabled = true;
                currentChatCfg.lastClearedAt = Date.now();
                if (!currentChatCfg.intervalMs) {
                    currentChatCfg.intervalMs = 24 * 60 * 60 * 1000;
                    currentChatCfg.intervalLabel = '24h';
                }
                config[chatId] = currentChatCfg;
                await saveAutoClearConfig(config);

                await sock.sendMessage(chatId, {
                    text: "✅ *Auto-Clear Enabled for this " + chatType + "!*\n\n• Interval: *" + currentChatCfg.intervalLabel + "*\n• The bot will automatically clear messages in this chat every " + currentChatCfg.intervalLabel + ".",
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (sub === 'off' || sub === 'disable' || sub === 'false') {
                currentChatCfg.enabled = false;
                config[chatId] = currentChatCfg;
                await saveAutoClearConfig(config);

                await sock.sendMessage(chatId, {
                    text: "❌ *Auto-Clear Disabled for this " + chatType + "!*",
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (sub === 'set' || sub === 'time' || sub === 'interval') {
                const timeArg = args[1];
                const parsedMs = parseDuration(timeArg);
                if (!parsedMs || parsedMs < 5 * 60 * 1000) {
                    await sock.sendMessage(chatId, {
                        text: "❌ *Invalid time format!* Minimum interval is 5m.\n\nExamples: `.autoclear set 1h`, `.autoclear set 6h`, `.autoclear set 12h`, `.autoclear set 24h`, `.autoclear set 3d`",
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                const label = formatDuration(parsedMs);
                currentChatCfg.enabled = true;
                currentChatCfg.intervalMs = parsedMs;
                currentChatCfg.intervalLabel = label;
                currentChatCfg.lastClearedAt = Date.now();
                config[chatId] = currentChatCfg;
                await saveAutoClearConfig(config);

                await sock.sendMessage(chatId, {
                    text: "✅ *Auto-Clear Interval Set to " + label + "!*\n\n• This " + chatType + " will now auto-clear every *" + label + "*.",
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (sub === 'list') {
                const entries = Object.entries(config).filter(([_, d]) => d && d.enabled);
                if (entries.length === 0) {
                    await sock.sendMessage(chatId, {
                        text: "ℹ️ *No chats or groups currently have auto-clear enabled.*\n\nUse `.autoclear on` to enable it here.",
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                let listText = "*📋 AUTO-CLEAR ACTIVE LIST (" + entries.length + ")*\n\n";
                entries.forEach(([id, d], idx) => {
                    const isG = id.endsWith('@g.us');
                    const label = d.intervalLabel || '24h';
                    listText += (idx + 1) + ". *" + (isG ? 'Group' : 'DM') + "*: `" + id.split('@')[0] + "`\n   • Interval: " + label + "\n\n";
                });

                await sock.sendMessage(chatId, {
                    text: listText.trim(),
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            await sock.sendMessage(chatId, {
                text: "❌ *Unknown sub-command!*\n\nUse: `.autoclear on`, `.autoclear off`, `.autoclear set 12h`, `.autoclear status`, or `.autoclear list`",
                ...channelInfo
            }, { quoted: message });

        } catch (error) {
            console.error('Error in autoclear command:', error);
            await sock.sendMessage(chatId, {
                text: "❌ *Error:* " + error.message,
                ...channelInfo
            }, { quoted: message });
        }
    },

    initAutoClear,
    runAutoClearCheck
};