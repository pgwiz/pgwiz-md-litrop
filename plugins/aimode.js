const chatbot = require('./chatbot');

module.exports = {
    ...chatbot,
    command: 'aimode',
    aliases: ['chatbot', 'chatgpt', 'chatbots', 'autochat', 'achat', 'repal', 'repan'],
    description: 'Configure Conversational AI persona modes, depth levels, and group reply-to-all (repal/repan)',
    usage: '.aimode [on|off|status|<mode> [level] [repal|repan] [jid]]'
};


