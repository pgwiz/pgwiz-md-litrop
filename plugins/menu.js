const CommandHandler = require('../lib/commandHandler');
const settings = require("../settings");
const store = require('../lib/lightweight_store');
const fs = require('fs');
const path = require('path');

const DIVIDER = '━━━━━━━━━━━━━';

function formatTime() {
  try {
    const now = new Date();
    const options = {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: settings.timeZone || 'Africa/Nairobi'
    };
    return now.toLocaleTimeString('en-US', options);
  } catch {
    return new Date().toLocaleTimeString('en-US');
  }
}

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

module.exports = {
  command: 'menu',
  aliases: ['help', 'commands', 'smenu', 'shelp', 'smart', 'list', 'h'],
  category: 'general',
  description: 'Interactive clean menu with live status and command list',
  usage: '.menu [command]',
  isPrefixless: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const prefix = settings.prefixes ? settings.prefixes[0] : '.';
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const version = settings.version || '5.2.0';
    const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

    // 1. Single Command Lookup
    if (args.length) {
      const searchTerm = args[0].toLowerCase();
      
      let cmd = CommandHandler.commands.get(searchTerm);
      if (!cmd && CommandHandler.aliases.has(searchTerm)) {
        const mainCommand = CommandHandler.aliases.get(searchTerm);
        cmd = CommandHandler.commands.get(mainCommand);
      }
      
      if (!cmd) {
        return await sock.sendMessage(chatId, { 
          text: `*✩ ${botName} HELP ✩*\n${DIVIDER}\n❌ Command *${args[0]}* not found.\nUse *${prefix}menu* to browse commands.\n${DIVIDER}`,
          ...channelInfo
        }, { quoted: message });
      }

      const text = `*✩ ${botName} COMMAND INFO ✩*
${DIVIDER}
⚡ *Command:* ${prefix}${cmd.command}
📝 *Description:* ${cmd.description || 'No description provided'}
📖 *Usage:* ${cmd.usage || `${prefix}${cmd.command}`}
🏷️ *Category:* ${cmd.category || 'general'}
🔖 *Aliases:* ${cmd.aliases?.length ? cmd.aliases.map(a => prefix + a).join(', ') : 'None'}
${DIVIDER}`;

      if (fs.existsSync(imagePath)) {
        return await sock.sendMessage(chatId, {
          image: { url: imagePath },
          caption: text,
          ...channelInfo
        }, { quoted: message });
      }

      return await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
    }

    // 2. Full Categorized Menu
    try {
      const categories = Array.from(CommandHandler.categories.keys()).sort();
      const stats = CommandHandler.getDiagnostics();
      const uptimeText = getUptimeString();
      const timeText = formatTime();

      let menuText = `*✩ ${botName} MENU ✩*
${DIVIDER}
🟢 *Status:* ACTIVE
⏱️ *Uptime:* ${uptimeText}
🔌 *Plugins:* ${CommandHandler.commands.size}
⚙️ *Prefix:* ${prefix}
🕐 *Time:* ${timeText}
🤖 *Version:* ${version}
${DIVIDER}\n\n`;

      const topCmds = stats.slice(0, 3).filter(s => s.usage > 0);
      if (topCmds.length > 0) {
        menuText += `*✩ TOP COMMANDS ✩*\n${DIVIDER}\n`;
        topCmds.forEach((c, i) => {
          const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          menuText += `${rank} *${prefix}${c.command}* (${c.usage} uses)\n`;
        });
        menuText += `${DIVIDER}\n\n`;
      }

      for (const cat of categories) {
        const catCmds = CommandHandler.getCommandsByCategory(cat);
        if (!catCmds || catCmds.length === 0) continue;

        menuText += `*✩ ${cat.toUpperCase()} ✩*\n${DIVIDER}\n`;
        catCmds.forEach((cmdName) => {
          const isOff = CommandHandler.disabledCommands.has(cmdName.toLowerCase());
          const dot = isOff ? '🔴' : '🟢';
          menuText += `${dot} *${prefix}${cmdName}*\n`;
        });
        menuText += `${DIVIDER}\n\n`;
      }

      menuText = menuText.trim();

      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(chatId, {
          image: { url: imagePath },
          caption: menuText,
          ...channelInfo
        }, { quoted: message });
      } else {
        await sock.sendMessage(chatId, {
          text: menuText,
          ...channelInfo
        }, { quoted: message });
      }

    } catch (error) {
      console.error('Menu Error:', error);
      await sock.sendMessage(chatId, {
        text: `*✩ ${botName} MENU ✩*\n${DIVIDER}\n❌ Error generating menu: ${error.message}\n${DIVIDER}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
