const chatbotPlugin = require('./chatbot');

module.exports = {
    ...chatbotPlugin,
    command: 'aimode',
    aliases: ['chatbot', 'mistral', 'chatgpt', 'chatbots', 'autochat', 'achat']
};
