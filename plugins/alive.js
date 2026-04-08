const os = require("os");
const process = require("process");
const settings = require("../settings");

module.exports = {
  command: 'alive',
  aliases: ['status', 'bot', 'info'],
  category: 'general',
  description: 'Check bot status and system info',
  usage: '.alive',
  isPrefixless: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      // Calculate uptime from process start
      let uptime = Math.floor(process.uptime());

      const days = Math.floor(uptime / 86400);
      uptime %= 86400;
      const hours = Math.floor(uptime / 3600);
      uptime %= 3600;
      const minutes = Math.floor(uptime / 60);
      const seconds = uptime % 60;

      // Format uptime as readable string (e.g., "2d 5h 30m")
      const uptimeParts = [];
      if (days) uptimeParts.push(`${days}d`);
      if (hours) uptimeParts.push(`${hours}h`);
      if (minutes) uptimeParts.push(`${minutes}m`);
      if (seconds || uptimeParts.length === 0) uptimeParts.push(`${seconds}s`);

      const uptimeText = uptimeParts.join(' ');
      
      // Get system resource info
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
      const cpuLoad = os.loadavg()[0].toFixed(2);
      const platform = os.platform();
      const arch = os.arch();
      const nodeVersion = process.version;

      // Memory health indicator
      let memEmoji = '🟢';
      if (memPercent > 70) memEmoji = '🟡';
      if (memPercent > 85) memEmoji = '🔴';

      // CPU health indicator
      let cpuEmoji = '🟢';
      if (cpuLoad > 0.7) cpuEmoji = '🟡';
      if (cpuLoad > 1.5) cpuEmoji = '🔴';

      // Build status message with dev formatting
      const text = `
═══════════════════════════
🤖 PGWIZ-MD STATUS
═══════════════════════════

✅ *STATUS:* ACTIVE & RUNNING

━━━━━━ BOT INFO ━━━━━━
📦 *Version:* ${settings.version}
👤 *Owner:* ${settings.botOwner}
⏱️ *Uptime:* ${uptimeText}

━━━━ SYSTEM RESOURCES ━━━━
${memEmoji} *RAM:* ${usedMem}MB / ${totalMem}MB (${memPercent}%)
${cpuEmoji} *CPU:* ${cpuLoad} load avg
🖥️ *Platform:* ${platform} (${arch})
⚙️ *Node.js:* ${nodeVersion}

═══════════════════════════
⏰ Timestamp: ${new Date().toLocaleString()}`;

      await sock.sendMessage(chatId, {
        text,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || '120363179639202475@newsletter',
            newsletterName: settings.newsletterName || 'PGWIZ-MD',
            serverMessageId: -1
          }
        }
      }, { quoted: message });

    } catch (error) {
      console.error('Error in alive command:', error);
      await sock.sendMessage(chatId, {
        text: '✅ Bot is alive and running!'
      }, { quoted: message });
    }
  }
};
