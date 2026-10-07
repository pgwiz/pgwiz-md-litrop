const os = require("os");
const process = require("process");
const settings = require("../settings");

const DIVIDER = '━━━━━━━━━━━━━';

function getUptimeString() {
  let uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  uptime %= 86400;
  const hours = Math.floor(uptime / 3600);
  uptime %= 3600;
  const minutes = Math.floor(uptime / 60);
  const seconds = uptime % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getTimeString() {
  try {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: settings.timeZone || 'Africa/Nairobi'
    });
  } catch {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }
}

module.exports = {
  command: 'alive',
  aliases: ['status', 'system', 'botstatus', 'bot', 'uptime', 'runtime', 'info'],
  category: 'general',
  description: 'Check bot status, active uptime, system telemetry, and runtime info',
  usage: '.alive | .uptime | .status',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    try {
      let commandCount = 0;
      try {
        const commandHandler = require('../lib/commandHandler');
        if (commandHandler && commandHandler.commands && commandHandler.commands.size > 0) {
          commandCount = commandHandler.commands.size;
        }
      } catch {}
      if (!commandCount) {
        try {
          const fs = require('fs');
          const path = require('path');
          commandCount = fs.readdirSync(path.join(__dirname, '../plugins')).filter(f => f.endsWith('.js')).length;
        } catch {
          commandCount = 69;
        }
      }

      const uptimeText = getUptimeString();
      const timeText = getTimeString();

      // System resource telemetry
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const memPercent = (totalMem > 0) ? ((usedMem / totalMem) * 100).toFixed(1) : 0;
      const cpuLoad = (os.loadavg()[0] || 0.00).toFixed(2);

      let statusColor = '🟢';
      if (memPercent > 85 || cpuLoad > 1.5) statusColor = '🔴';
      else if (memPercent > 70 || cpuLoad > 0.7) statusColor = '🟡';

      const botName = (settings.botName || process.env.BOT_NAME || 'PGWIZ-MD').toUpperCase();
      const version = settings.version || '5.2.0';

      const card = `*✩ ${botName} STATUS ✩*
${DIVIDER}
${statusColor} *Status:* ACTIVE
${DIVIDER}
⏱️ *Uptime:* ${uptimeText}
🔌 *Plugins:* ${commandCount}
${DIVIDER}
💾 *RAM:* ${usedMem}/${totalMem} MB
⚙️ *CPU:* ${cpuLoad} load
${DIVIDER}
🕐 *Time:* ${timeText}
🤖 *Version:* ${version}
${DIVIDER}`;

      await sock.sendMessage(chatId, {
        text: card,
        ...channelInfo
      }, { quoted: message });

    } catch (error) {
      console.error('Error in alive/status command:', error);
      const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
      await sock.sendMessage(chatId, {
        text: `*✩ ${botName} STATUS ✩*\n${DIVIDER}\n🟢 *Status:* ACTIVE\n${DIVIDER}`
      }, { quoted: message });
    }
  }
};
