const settings = require('../settings');
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || '120363179639202475@newsletter',
            newsletterName: settings.newsletterName || 'PGWIZ-MD',
            serverMessageId: -1
        }
    }
};

module.exports = {
    channelInfo: channelInfo
};
