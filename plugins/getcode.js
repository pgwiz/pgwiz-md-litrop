const { getPanelAccessCode } = require('../lib/server');
const isOwnerOrSudo = require('../lib/isOwner');

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
            text = `╔════════════════════════════════════╗\n` +
                   `║     🔐 WEB PANEL ACCESS KEY        ║\n` +
                   `╚════════════════════════════════════╝\n\n` +
                   `🔑 *Active Key:* *${authInfo.key}*\n` +
                   `📌 *Type:* Static Environment Secret\n` +
                   `⏳ *Validity:* Permanent\n\n` +
                   `🌐 *Direct Access Link:*\n${panelLink}\n\n` +
                   `_To switch to dynamic rotating codes, unset PANEL_PASSWORD in environment settings._`;
        } else {
            const totalSec = typeof authInfo.expiresInSeconds === 'number' ? authInfo.expiresInSeconds : 0;
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            const timeStr = `${mins}m ${secs}s`;

            text = `╔════════════════════════════════════╗\n` +
                   `║     🔐 WEB PANEL ACCESS KEY        ║\n` +
                   `╚════════════════════════════════════╝\n\n` +
                   `🔑 *Temporary Key:* *${authInfo.key}*\n` +
                   `⏳ *Validity Remaining:* ${timeStr}\n` +
                   `🔄 *Action:* ${forceNew ? 'Fresh Key Generated' : 'Active Key Retrieved'}\n\n` +
                   `🌐 *Direct Access Link:*\n${panelLink}\n\n` +
                   `💡 *Tip:* Type \`.getcode new\` to rotate and issue a fresh key immediately.`;
        }

        await sock.sendMessage(chatId, {
            text,
            ...channelInfo
        }, { quoted: message });
    }
};
