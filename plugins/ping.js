const settings = require('../settings');

module.exports = {
  command: 'ping',
  aliases: ['p', 'pong', 'speed'],
  category: 'general',
  description: 'Check bot response latency and status',
  usage: '.ping',
  
  async handler(sock, message, args) {
    const start = Date.now();
    const chatId = message.key.remoteJid;
    const latency = Math.max(1, Date.now() - start);
    
    let statusEmoji = '🟢';
    if (latency > 100) statusEmoji = '🟡';
    if (latency > 500) statusEmoji = '🔴';
    
    const text = `${statusEmoji} *PGWIZ-MD PING*

⚡ *Latency:* ${latency}ms
🤖 *Bot:* ${settings.botName || 'PGWIZ-MD'}
📦 *Version:* ${settings.version || '1.2.0'}
⏰ *Timestamp:* ${new Date().toLocaleTimeString()}`;
    
    await sock.sendMessage(chatId, {
      text: text
    }, { quoted: message });
  }
};
