module.exports = {
    command: 'keepalive',
    aliases: ['alivepulse', 'heartbeat', 'kpalive'],
    category: 'owner',
    description: 'Inspect or control active WhatsApp connection keepalive heartbeat & ping',
    usage: '.keepalive | .keepalive ping | .keepalive <on|off>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const action = args[0] ? args[0].toLowerCase().trim() : '';

        try {
            const isWsOpen = sock && sock.ws && sock.ws.readyState === 1;
            const hasTimer = !!sock?._keepAliveTimer;

            if (action === 'ping') {
                const startTime = Date.now();
                if (!isWsOpen) {
                    return await sock.sendMessage(chatId, {
                        text: '❌ WebSocket is not connected.',
                        ...channelInfo
                    }, { quoted: message });
                }

                try {
                    const tag = typeof sock.generateMessageTag === 'function' ? sock.generateMessageTag() : `${Date.now()}`;
                    await sock.query({
                        tag: 'iq',
                        attrs: {
                            id: tag,
                            type: 'get',
                            xmlns: 'w:p',
                            to: 's.whatsapp.net'
                        }
                    });
                    const latency = Date.now() - startTime;
                    return await sock.sendMessage(chatId, {
                        text: `🏓 *Keepalive Ping Response*\n\n• *Latency:* ${latency}ms\n• *WebSocket:* 🟢 Connected (ReadyState 1)\n• *Keepalive Pulse:* ${hasTimer ? '✅ Active (45s)' : '⚠️ Standby'}`,
                        ...channelInfo
                    }, { quoted: message });
                } catch (pingErr) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ *Keepalive Ping Error:* ${pingErr.message}`,
                        ...channelInfo
                    }, { quoted: message });
                }
            }

            if (action === 'on' || action === 'start' || action === 'enable') {
                if (typeof sock.startKeepAlive === 'function') {
                    sock.startKeepAlive(45000);
                    return await sock.sendMessage(chatId, {
                        text: '🟢 *Keepalive Heartbeat Started*\n\n• Pulse interval: 45 seconds\n• Mode: XMPP ping + companion presence keepalive',
                        ...channelInfo
                    }, { quoted: message });
                }
            }

            if (action === 'off' || action === 'stop' || action === 'disable') {
                if (typeof sock.stopKeepAlive === 'function') {
                    sock.stopKeepAlive();
                    return await sock.sendMessage(chatId, {
                        text: '🔴 *Keepalive Heartbeat Stopped*',
                        ...channelInfo
                    }, { quoted: message });
                }
            }

            // Default: Status
            const statusText = `📡 *WHATSAPP KEEPALIVE STATUS*\n\n` +
                `• *Heartbeat State:* ${hasTimer ? '🟢 Active & Running' : '🟡 Standby / Stopped'}\n` +
                `• *Pulse Interval:* 45 seconds\n` +
                `• *WebSocket:* ${isWsOpen ? '🟢 Connected (Open)' : '🔴 Disconnected'}\n` +
                `• *Companion Presence:* Auto-refreshed to prevent dormant status\n\n` +
                `*Commands:*\n` +
                `• \`.keepalive ping\` - Measure server XMPP round-trip latency\n` +
                `• \`.keepalive on\` - Force start 45s keepalive pulse\n` +
                `• \`.keepalive off\` - Stop keepalive pulse`;

            return await sock.sendMessage(chatId, {
                text: statusText,
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            return await sock.sendMessage(chatId, {
                text: `❌ Error in keepalive handler: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
