const fs = require('fs');
const store = require('../lib/lightweight_store');
const settings = require('../settings');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const PMBLOCKER_PATH = './data/pmblocker.json';
const DEFAULT_MESSAGE = '⚠️ Direct messages are blocked!\nYou cannot DM this bot. Please contact the owner in group chats only.';
const DIVIDER = '━━━━━━━━━━━━━';

async function readState() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'pmblocker');
            if (!data) {
                return { enabled: false, message: DEFAULT_MESSAGE };
            }
            return {
                enabled: !!data.enabled,
                message: typeof data.message === 'string' && data.message.trim() 
                    ? data.message 
                    : DEFAULT_MESSAGE
            };
        } else {
            if (!fs.existsSync(PMBLOCKER_PATH)) {
                return { enabled: false, message: DEFAULT_MESSAGE };
            }
            const raw = fs.readFileSync(PMBLOCKER_PATH, 'utf8');
            const data = JSON.parse(raw || '{}');
            return {
                enabled: !!data.enabled,
                message: typeof data.message === 'string' && data.message.trim() 
                    ? data.message 
                    : DEFAULT_MESSAGE
            };
        }
    } catch {
        return { enabled: false, message: DEFAULT_MESSAGE };
    }
}

async function writeState(enabled, message) {
    try {
        const current = await readState();
        const payload = {
            enabled: !!enabled,
            message: typeof message === 'string' && message.trim() ? message : current.message
        };
        
        if (HAS_DB) {
            await store.saveSetting('global', 'pmblocker', payload);
        } else {
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }
            fs.writeFileSync(PMBLOCKER_PATH, JSON.stringify(payload, null, 2));
        }
    } catch (e) {
        console.error('Error writing PM blocker state:', e);
    }
}

module.exports = {
    command: 'pmblocker',
    aliases: ['pmblock', 'blockpm', 'antipm'],
    category: 'owner',
    description: 'Block private messages and auto-block users who DM the bot',
    usage: '.pmblocker <on|off|status|setmsg>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const state = await readState();
        const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
        
        const sub = args[0]?.toLowerCase();
        const rest = args.slice(1);

        if (!sub || !['on', 'off', 'status', 'setmsg'].includes(sub)) {
            await sock.sendMessage(chatId, {
                text: `*✩ ${botName} PM BLOCKER ✩*\n${DIVIDER}\n` +
                      `${state.enabled ? '🟢' : '🔴'} *Status:* ${state.enabled ? 'ENABLED' : 'DISABLED'}\n` +
                      `💾 *Storage:* ${HAS_DB ? 'Database' : 'Local File'}\n` +
                      `${DIVIDER}\n` +
                      `*Commands:*\n` +
                      `• \`.pmblocker on\` - Enable\n` +
                      `• \`.pmblocker off\` - Disable\n` +
                      `• \`.pmblocker status\` - Status\n` +
                      `• \`.pmblocker setmsg <text>\` - Set warning message\n` +
                      `${DIVIDER}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        if (sub === 'status') {
            await sock.sendMessage(chatId, {
                text: `*✩ ${botName} PM BLOCKER STATUS ✩*\n${DIVIDER}\n` +
                      `${state.enabled ? '🟢' : '🔴'} *Status:* ${state.enabled ? 'ENABLED' : 'DISABLED'}\n` +
                      `💾 *Storage:* ${HAS_DB ? 'Database' : 'Local File'}\n` +
                      `💬 *Warning Message:*\n${state.message}\n` +
                      `${DIVIDER}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        if (sub === 'setmsg') {
            const newMsg = rest.join(' ').trim();
            if (!newMsg) {
                await sock.sendMessage(chatId, {
                    text: `*✩ ${botName} PM BLOCKER ✩*\n${DIVIDER}\n⚠️ *Usage:* \`.pmblocker setmsg <your message>\`\n${DIVIDER}`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            await writeState(state.enabled, newMsg);
            await sock.sendMessage(chatId, {
                text: `*✩ ${botName} PM BLOCKER ✩*\n${DIVIDER}\n✅ *Warning message updated:*\n${newMsg}\n${DIVIDER}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const enable = sub === 'on';
        await writeState(enable);
        
        await sock.sendMessage(chatId, {
            text: `*✩ ${botName} PM BLOCKER ✩*\n${DIVIDER}\n` +
                  `${enable ? '🟢' : '🔴'} *Status:* ${enable ? 'ENABLED' : 'DISABLED'}\n` +
                  `ℹ️ *Policy:* ${enable ? 'Incoming DMs will receive warning and be blocked.' : 'Private messages permitted.'}\n` +
                  `${DIVIDER}`,
            ...channelInfo
        }, { quoted: message });
    },

    readState,
    writeState
};
