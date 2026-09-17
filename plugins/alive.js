const os = require("os");
const process = require("process");
const settings = require("../settings");

module.exports = {
  command: 'alive',
  aliases: ['status', 'bot', 'uptime', 'runtime', 'info'],
  category: 'general',
  description: 'Check bot status, active uptime, system telemetry, and runtime info',
  usage: '.alive | .uptime | .status',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      let commandCount = 'N/A';
      try {
        const commandHandler = require('../lib/commandHandler');
        if (commandHandler && commandHandler.commands) {
          commandCount = commandHandler.commands.size;
        }
      } catch {}

      // Calculate uptime from process start
      const uptimeMs = process.uptime() * 1000;
      let uptime = Math.floor(process.uptime());

      const days = Math.floor(uptime / 86400);
      uptime %= 86400;
      const hours = Math.floor(uptime / 3600);
      uptime %= 3600;
      const minutes = Math.floor(uptime / 60);
      const seconds = uptime % 60;

      const uptimeParts = [];
      if (days) uptimeParts.push(`${days}d`);
      if (hours) uptimeParts.push(`${hours}h`);
      if (minutes) uptimeParts.push(`${minutes}m`);
      if (seconds || uptimeParts.length === 0) uptimeParts.push(`${seconds}s`);

      const uptimeText = uptimeParts.join(' ');
      const startedAt = new Date(Date.now() - uptimeMs).toLocaleString();

      // Get system resource info
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
      const cpuLoad = os.loadavg()[0].toFixed(2);
      const platform = os.platform();
      const arch = os.arch();
      const nodeVersion = process.version;

      let memEmoji = '🟢';
      if (memPercent > 70) memEmoji = '🟡';
      if (memPercent > 85) memEmoji = '🔴';

      let cpuEmoji = '🟢';
      if (cpuLoad > 0.7) cpuEmoji = '🟡';
      if (cpuLoad > 1.5) cpuEmoji = '🔴';

      const botName = settings.botName || process.env.BOT_NAME || 'PGWIZ-MD';
      const botOwner = settings.botOwner || process.env.BOT_OWNER || 'pgwiz';
      const version = settings.version || '2.0.0';

      const text = `
═══════════════════════════
🤖 ${botName.toUpperCase()} STATUS
═══════════════════════════

✅ *STATUS:* ACTIVE & RUNNING

━━━━━━ BOT INFO ━━━━━━
📦 *Version:* ${version}
👤 *Owner:* ${botOwner}
⏱️ *Uptime:* ${uptimeText}
🚀 *Started:* ${startedAt}
🧩 *Plugins:* ${commandCount}

━━━━ SYSTEM RESOURCES ━━━━
${memEmoji} *RAM:* ${usedMem}MB / ${totalMem}MB (${memPercent}%)
${cpuEmoji} *CPU:* ${cpuLoad} load avg
🖥️ *Platform:* ${platform} (${arch})
⚙️ *Node.js:* ${nodeVersion}

═══════════════════════════
⏰ Timestamp: ${new Date().toLocaleString()}`.trim();

      await sock.sendMessage(chatId, {
        text,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: settings.newsletterJid || '120363179639202475@newsletter',
            newsletterName: settings.newsletterName || botName,
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
