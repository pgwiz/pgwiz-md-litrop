const { performance } = require('perf_hooks');
const settings = require('../settings');

module.exports = {
  command: 'ping',
  aliases: ['p', 'pong', 'speed', 'pingweb', 'pweb'],
  category: 'general',
  description: 'Check real-time response latency, execution speed, or ping a website',
  usage: '.ping [website URL]',
  
  async handler(sock, message, args, context = {}) {
    const start = performance.now();
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const rawTarget = (args || []).join(' ').trim();
    
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

    // 1. Website ping mode if argument provided
    if (rawTarget) {
      const axios = require('axios');
      let testUrl = rawTarget;
      if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
        testUrl = 'https://' + testUrl;
      }

      try {
        const urlObj = new URL(testUrl);
        const webStart = Date.now();
        const response = await axios.get(testUrl, {
          timeout: 10000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const webLatency = Date.now() - webStart;

        const webText = `${statusEmoji} *${botName.toUpperCase()} PING & WEB CHECK*
        
⚡ *Bot Latency:* ${displayLatency}
⚙️ *Exec Speed:* ${execSpeed}ms

🌐 *Host:* ${urlObj.hostname}
📶 *Web Response:* ${webLatency}ms
📡 *HTTP Status:* ${response.status} ${response.statusText || 'OK'}
✅ *Reachability:* Operational
⏰ *Time:* ${new Date().toLocaleTimeString()}`;

        return await sock.sendMessage(chatId, {
          text: webText.trim(),
          ...channelInfo
        }, { quoted: message });

      } catch (webErr) {
        let errReason = webErr.message;
        if (webErr.code === 'ENOTFOUND') errReason = 'Domain not found / DNS failure';
        else if (webErr.code === 'ETIMEDOUT' || webErr.code === 'ECONNABORTED') errReason = 'Connection timed out';

        const failText = `🏓 *${botName.toUpperCase()} WEB PING*
        
⚡ *Bot Latency:* ${displayLatency}
⚙️ *Exec Speed:* ${execSpeed}ms

🌐 *Target:* ${rawTarget}
❌ *Status:* Unreachable (${errReason})
⏰ *Time:* ${new Date().toLocaleTimeString()}`;

        return await sock.sendMessage(chatId, {
          text: failText.trim(),
          ...channelInfo
        }, { quoted: message });
      }
    }
    
    // 2. Standard Bot Speed Ping
    const text = `${statusEmoji} *${botName.toUpperCase()} PING*

⚡ *Latency:* ${displayLatency}
⚙️ *Exec Speed:* ${execSpeed}ms
⏰ *Time:* ${new Date().toLocaleTimeString()}

💡 *Tip:* Use \`.ping <url>\` to test website reachability`;
    
    await sock.sendMessage(chatId, {
      text: text.trim(),
      ...channelInfo
    }, { quoted: message });
  }
};
