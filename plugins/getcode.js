const { getPanelAccessCode } = require('../lib/server');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
    command: 'getcode',
    aliases: ['code', 'panelcode', 'webcode', 'logincode', 'accesskey'],
    category: 'owner',
    description: 'Retrieve or rotate the web panel security access code',
    usage: '.getcode [new|rotate]',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.sender || message.key.participant || chatId;
        const channelInfo = context.channelInfo || {};
        const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();

        // Enforce owner / sudo permission
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Access Denied:* This command is restricted to the bot owner and sudo users.',
                ...channelInfo
            }, { quoted: message });
        }

        const subCmd = (args[0] || '').toLowerCase();
        const forceNew = subCmd === 'new' || subCmd === 'rotate' || subCmd === 'reset';

        let authInfo;
        try {
            authInfo = await getPanelAccessCode(forceNew);
        } catch (e) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Error retrieving panel access key:* ' + (e.message || e),
                ...channelInfo
            }, { quoted: message });
        }

        const hostUrl = process.env.APP_URL || process.env.KOYEB_APP_URL || process.env.HEROKU_APP_URL || 'https://drunk-cati-wiptechgx-d794d1cd.koyeb.app';
        const baseUrl = hostUrl.replace(/\/+$/, '');
        const panelLink = `${baseUrl}/panel?key=${encodeURIComponent(authInfo.key)}`;

        let text = '';
        if (authInfo.type === 'env') {
            text = `*✩ ${botName} ACCESS KEY ✩*\n${DIVIDER}\n` +
                   `🔑 *Key:* \`${authInfo.key}\`\n` +
                   `📌 *Type:* Static Environment Secret\n` +
                   `⏳ *Validity:* Permanent\n${DIVIDER}\n` +
                   `🌐 *Panel Link:*\n${panelLink}\n${DIVIDER}`;
        } else {
            const totalSec = typeof authInfo.expiresInSeconds === 'number' ? authInfo.expiresInSeconds : 0;
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            const timeStr = `${mins}m ${secs}s`;

            text = `*✩ ${botName} ACCESS KEY ✩*\n${DIVIDER}\n` +
                   `🔑 *Key:* \`${authInfo.key}\`\n` +
                   `⏳ *Remaining:* ${timeStr}\n` +
                   `🔄 *Action:* ${forceNew ? 'Fresh Key Generated' : 'Active Key Retrieved'}\n${DIVIDER}\n` +
                   `🌐 *Panel Link:*\n${panelLink}\n${DIVIDER}`;
        }

        await sock.sendMessage(chatId, {
            text,
            ...channelInfo
        }, { quoted: message });
    }
};
