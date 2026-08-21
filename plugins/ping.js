const { performance } = require('perf_hooks');
const settings = require('../settings');

module.exports = {
  command: 'ping',
  aliases: ['p', 'pong', 'speed'],
  category: 'general',
  description: 'Check real-time response latency and execution speed',
  usage: '.ping',
  
  async handler(sock, message, args, context = {}) {
    const start = performance.now();
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    
    // Calculate real WhatsApp message transmission latency
    let transitLatency = null;
    const rawTs = message.messageTimestamp;
    if (rawTs) {
      const tsMs = typeof rawTs === 'object' && rawTs.low ? rawTs.low * 1000 : Number(rawTs) * 1000;
      if (tsMs > 0 && tsMs <= Date.now()) {
        transitLatency = Date.now() - tsMs;
      }
    }
    
    const execSpeed = (performance.now() - start).toFixed(2);
    const displayLatency = transitLatency !== null ? `${transitLatency}ms` : `${execSpeed}ms`;
    const numLatency = transitLatency !== null ? transitLatency : parseFloat(execSpeed);
    
    let statusEmoji = '🟢';
    if (numLatency > 200) statusEmoji = '🟡';
    if (numLatency > 800) statusEmoji = '🔴';
    
    const botName = settings.botName || process.env.BOT_NAME || 'PGWIZ-MD';
    const version = settings.version || '5.2.0';
    
    const text = `${statusEmoji} *${botName.toUpperCase()} PING*

⚡ *Latency:* ${displayLatency}
⚙️ *Exec Speed:* ${execSpeed}ms
🤖 *Bot:* ${botName}
📦 *Version:* v${version}
⏰ *Time:* ${new Date().toLocaleTimeString()}`;
    
    await sock.sendMessage(chatId, {
      text: text,
      ...channelInfo
    }, { quoted: message });
  }
};
