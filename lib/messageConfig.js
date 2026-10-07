'use strict';

const settings = require('../settings');

const channelUrl = settings.channelLink || 'https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K';

const channelButton = {
    type: 'url',
    text: '📢 Open Channel',
    url: channelUrl
};

const channelInfo = {
    buttons: [
        channelButton
    ]
};

module.exports = {
    channelInfo,
    channelButton,
    channelUrl
};
