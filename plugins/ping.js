const settings = require('../settings');

module.exports = {
  command: 'ping',
  aliases: ['p', 'pong'],
  category: 'general',
  description: 'Check bot response time',
  usage: '.ping',
  isPrefixless: true,
  
  async handler(sock, message, args) {
    const start = Date.now();
    const chatId = message.key.remoteJid;
    
    const sent = await sock.sendMessage(chatId, { 
      text: '⏱️ Measuring latency...' 
    });
    
    const end = Date.now();
    const latency = end - start;
    
    let statusEmoji = '🟢';
    if (latency > 100) statusEmoji = '🟡';
    if (latency > 500) statusEmoji = '🔴';
    
    const text = `${statusEmoji} *PING RESPONSE*

⚡ Latency: *${latency}ms*
🤖 Bot: *${settings.botName}*
📦 Version: *${settings.version}*
⏰ Timestamp: *${new Date().toLocaleTimeString()}*`;
    
    await sock.sendMessage(chatId, {
      text: text,
      edit: sent.key
    });
  }
};
