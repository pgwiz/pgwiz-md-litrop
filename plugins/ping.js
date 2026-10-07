const { performance } = require('perf_hooks');
const settings = require('../settings');

const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'ping',
  aliases: ['p', 'pong', 'speed', 'speedtest', 'pingweb', 'pweb'],
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
    
    const botName = (settings.botName || process.env.BOT_NAME || 'PGWIZ-MD').toUpperCase();

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

        const webText = `*✩ ${botName} WEB PING ✩*
${DIVIDER}
⚡ *Latency:* ${displayLatency} ${statusEmoji}
⚙️ *Exec:* ${execSpeed}ms
${DIVIDER}
🌐 *Host:* ${urlObj.hostname}
📶 *Web:* ${webLatency}ms
📡 *HTTP:* ${response.status} ${response.statusText || 'OK'}
${DIVIDER}`;

        return await sock.sendMessage(chatId, {
          text: webText.trim(),
          ...channelInfo
        }, { quoted: message });

      } catch (webErr) {
        let errReason = webErr.message;
        if (webErr.code === 'ENOTFOUND') errReason = 'DNS failure';
        else if (webErr.code === 'ETIMEDOUT' || webErr.code === 'ECONNABORTED') errReason = 'Timed out';

        const failText = `*✩ ${botName} WEB PING ✩*
${DIVIDER}
⚡ *Latency:* ${displayLatency} ${statusEmoji}
⚙️ *Exec:* ${execSpeed}ms
${DIVIDER}
🌐 *Target:* ${rawTarget}
❌ *Status:* Failed (${errReason})
${DIVIDER}`;

        return await sock.sendMessage(chatId, {
          text: failText.trim(),
          ...channelInfo
        }, { quoted: message });
      }
    }
    
    // 2. Standard Bot Speed Ping
    const text = `*✩ ${botName} PING ✩*
${DIVIDER}
⚡ *Latency:* ${displayLatency} ${statusEmoji}
⚙️ *Exec:* ${execSpeed}ms
${DIVIDER}`;
    
    await sock.sendMessage(chatId, {
      text: text.trim(),
      ...channelInfo
    }, { quoted: message });
  }
};
