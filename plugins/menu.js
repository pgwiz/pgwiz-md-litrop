const fs = require('fs');
const path = require('path');
const CommandHandler = require('../lib/commandHandler');
const settings = require('../settings');
const store = require('../lib/lightweight_store');

const CATEGORY_ICONS = {
  admin: '🛡️',
  ai: '🤖',
  apk: '📲',
  apks: '📲',
  download: '📥',
  downloader: '📥',
  downloads: '📥',
  fun: '🎮',
  game: '🎯',
  games: '🎯',
  general: '📱',
  group: '👥',
  groups: '👥',
  image: '🖼️',
  images: '🖼️',
  media: '🖼️',
  info: 'ℹ️',
  information: 'ℹ️',
  menu: '📜',
  music: '🎵',
  audio: '🎵',
  quote: '💬',
  quotes: '💬',
  search: '🔍',
  stalk: '👀',
  stalker: '👀',
  sticker: '🎭',
  stickers: '🎭',
  tool: '🔧',
  tools: '🔧',
  owner: '👑',
  creator: '👑',
  sudo: '👑',
  misc: '📦',
  miscellaneous: '📦',
  utility: '🛠️',
  utilities: '🛠️',
  nsfw: '🔞',
  anime: '🌸',
  economy: '💰',
  moderation: '⚖️',
  settings: '⚙️',
  dev: '💻',
  education: '📚',
  security: '🔒',
  conversion: '🔄',
  convert: '🔄',
  news: '📰',
  religious: '🌙',
  islamic: '🌙',
  bot: '🤖',
  system: '⚙️'
};

function getCategoryIcon(cat) {
  const c = String(cat || '').toLowerCase().trim();
  return CATEGORY_ICONS[c] || '📁';
}

function formatTime() {
  try {
    const tz = settings.timeZone || process.env.TZ || 'Africa/Nairobi';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz
    }).format(new Date());
  } catch {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
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

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

async function getBotMode() {
  try {
    if (store && typeof store.getBotMode === 'function') {
      const mode = await store.getBotMode();
      if (mode) return String(mode).toLowerCase();
    }
  } catch {}
  return String(settings.commandMode || 'public').toLowerCase();
}

function getTopCommands(prefix) {
  try {
    if (CommandHandler && typeof CommandHandler.getDiagnostics === 'function') {
      const stats = CommandHandler.getDiagnostics()
        .filter(s => s && s.usage > 0)
        .slice(0, 3);
      if (stats.length > 0) {
        return stats.map(c => `${prefix}${c.command} (${c.usage}×)`).join('  •  ');
      }
    }
  } catch {}
  return `${prefix}alive (2×)  •  ${prefix}menu (1×)  •  ${prefix}ping (1×)`;
}

function buildHeader({ botName, botOwner, version, prefix, totalCommands, totalCategories, mode, uptime, time, topCommands }) {
  return [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃ 🤖 Bot: ${botName}`,
    `┃ 👑 Owner: ${botOwner}`,
    `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
    `┃ 📦 Commands: ${totalCommands}  •  📂 Categories: ${totalCategories}`,
    `┃ 🛠️ Mode: ${mode}  •  ⏱️ Uptime: ${uptime}  •  🕒 ${time}`,
    `┃ 🔥 Top: ${topCommands}`,
    `┃`
  ];
}

function renderOverviewMenu({ botName, botOwner, version, prefix, totalCommands, categories, mode, uptime, time, topCommands }) {
  const lines = buildHeader({
    botName,
    botOwner,
    version,
    prefix,
    totalCommands,
    totalCategories: categories.length,
    mode,
    uptime,
    time,
    topCommands
  });

  lines.push(`┃ 📂 CATEGORIES — reply ${prefix}menu + number:`);
  categories.forEach((cat, idx) => {
    const icon = getCategoryIcon(cat.name);
    lines.push(`┃  ${icon} ${idx + 1}. ${cat.name.toUpperCase()} (${cat.count})`);
  });

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu <number|name> — open a category`);
  lines.push(`┃ 🔍 ${prefix}menu <command> — command help`);
  lines.push(`╰━━━━━━━━━━━━━━⬣`);

  return lines.join('\n');
}

function renderCategoryMenu({ botName, botOwner, version, prefix, categoryName, commands, mode, uptime, time }) {
  const icon = getCategoryIcon(categoryName);
  const count = commands.length;
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃ 🤖 Bot: ${botName}`,
    `┃ 👑 Owner: ${botOwner}`,
    `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
    `┃ 📂 Category: ${icon} ${categoryName.toUpperCase()} (${count})`,
    `┃ 🛠️ Mode: ${mode}  •  ⏱️ Uptime: ${uptime}  •  🕒 ${time}`,
    `┃`,
    `┃ 📂 COMMANDS — reply ${prefix}menu + command:`
  ];

  if (commands.length === 0) {
    lines.push(`┃  (No commands available)`);
  } else {
    commands.forEach(cmd => {
      const isOff = CommandHandler.disabledCommands && CommandHandler.disabledCommands.has(cmd.toLowerCase());
      const dot = isOff ? '🔴' : '•';
      lines.push(`┃  ${dot} ${prefix}${cmd}${isOff ? ' (disabled)' : ''}`);
    });
  }

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu <command> — command help`);
  lines.push(`┃ 🔙 ${prefix}menu — back to categories`);
  lines.push(`╰━━━━━━━━━━━━━━⬣`);

  return lines.join('\n');
}

function renderCommandHelp({ botName, botOwner, version, prefix, cmd }) {
  const isOff = CommandHandler.disabledCommands && CommandHandler.disabledCommands.has(cmd.command.toLowerCase());
  const icon = getCategoryIcon(cmd.category);
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃ 🤖 Bot: ${botName}`,
    `┃ 👑 Owner: ${botOwner}`,
    `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
    `┃`,
    `┃ ⚡ Command: ${prefix}${cmd.command}`,
    `┃ 📝 Description: ${cmd.description || 'No description provided'}`,
    `┃ 📖 Usage: ${cmd.usage || `${prefix}${cmd.command}`}`,
    `┃ 🏷️ Category: ${icon} ${(cmd.category || 'general').toUpperCase()}`,
    `┃ 🔖 Aliases: ${cmd.aliases && cmd.aliases.length ? cmd.aliases.map(a => `${prefix}${a}`).join(', ') : 'None'}`
  ];

  if (isOff) {
    lines.push(`┃ ⚠️ Status: Disabled`);
  }
  if (cmd.ownerOnly) {
    lines.push(`┃ 👑 Access: Owner Only`);
  } else if (cmd.adminOnly) {
    lines.push(`┃ 🛡️ Access: Admin Only`);
  }

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu — back to categories`);
  lines.push(`╰━━━━━━━━━━━━━━⬣`);

  return lines.join('\n');
}

function renderAllMenu({ botName, botOwner, version, prefix, totalCommands, categories, mode, uptime, time, topCommands }) {
  const lines = buildHeader({
    botName,
    botOwner,
    version,
    prefix,
    totalCommands,
    totalCategories: categories.length,
    mode,
    uptime,
    time,
    topCommands
  });

  lines.push(`┃ 📂 ALL CATEGORIES & COMMANDS:`);

  categories.forEach((cat) => {
    const icon = getCategoryIcon(cat.name);
    lines.push(`┃`);
    lines.push(`┃  ${icon} ${cat.name.toUpperCase()} (${cat.count})`);
    cat.commands.forEach(cmd => {
      const isOff = CommandHandler.disabledCommands && CommandHandler.disabledCommands.has(cmd.toLowerCase());
      const dot = isOff ? '🔴' : '•';
      lines.push(`┃   ${dot} ${prefix}${cmd}${isOff ? ' (off)' : ''}`);
    });
  });

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu <command> — command help`);
  lines.push(`┃ 🔙 ${prefix}menu — back to categories`);
  lines.push(`╰━━━━━━━━━━━━━━⬣`);

  return lines.join('\n');
}

function renderNotFound({ botName, botOwner, version, prefix, query, suggestion }) {
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃ 🤖 Bot: ${botName}`,
    `┃ 👑 Owner: ${botOwner}`,
    `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
    `┃`,
    `┃ ❌ Command or category "${query}" not found.`
  ];

  if (suggestion) {
    lines.push(`┃ 💡 Did you mean: ${prefix}${suggestion}`);
  }

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu — view category menu`);
  lines.push(`┃ 🔍 ${prefix}menu <command> — command help`);
  lines.push(`╰━━━━━━━━━━━━━━⬣`);

  return lines.join('\n');
}

async function sendMenu(sock, chatId, text, channelInfo, message) {
  const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
  if (fs.existsSync(imagePath)) {
    try {
      return await sock.sendMessage(chatId, {
        image: { url: imagePath },
        caption: text,
        ...channelInfo
      }, { quoted: message });
    } catch {}
  }

  return await sock.sendMessage(chatId, {
    text,
    ...channelInfo
  }, { quoted: message });
}

module.exports = {
  command: 'menu',
  aliases: ['help', 'commands', 'smenu', 'shelp', 'smart', 'list', 'h'],
  category: 'general',
  description: 'Interactive clean menu with live status and command list',
  usage: '.menu [category|command|number|all]',
  isPrefixless: true,

  async handler(sock, message, args = [], context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const prefix = context.usedPrefix || (settings.prefixes ? settings.prefixes[0] : '.');
    const botName = settings.botName || process.env.BOT_NAME || 'PGWIZ-MD';
    const botOwner = settings.botOwner || process.env.BOT_OWNER || 'pgwiz';
    const version = settings.version || '5.2.0';

    try {
      // Gather dynamic metrics
      const mode = await getBotMode();
      const uptime = getUptimeString();
      const time = formatTime();
      const topCommands = getTopCommands(prefix);
      const totalCommands = CommandHandler.commands.size || (() => {
        try {
          return fs.readdirSync(path.join(__dirname, '../plugins')).filter(f => f.endsWith('.js')).length;
        } catch {
          return 69;
        }
      })();

      // Build sorted active categories
      const rawCategories = Array.from(CommandHandler.categories.keys()).sort();
      const activeCategories = [];
      for (const cat of rawCategories) {
        const cmds = CommandHandler.getCommandsByCategory(cat);
        if (cmds && cmds.length > 0) {
          activeCategories.push({
            name: cat,
            count: cmds.length,
            commands: cmds
          });
        }
      }

      // Process input arguments
      let rawQuery = (args && args.length) ? args.join(' ').trim() : '';
      if (rawQuery.startsWith('+') || rawQuery.startsWith('#')) {
        rawQuery = rawQuery.replace(/^[+#]\s*/, '').trim();
      }

      // 1. Overview menu when no query is passed
      if (!rawQuery) {
        const text = renderOverviewMenu({
          botName,
          botOwner,
          version,
          prefix,
          totalCommands,
          categories: activeCategories,
          mode,
          uptime,
          time,
          topCommands
        });
        return await sendMenu(sock, chatId, text, channelInfo, message);
      }

      const lowerQuery = rawQuery.toLowerCase();

      // 2. Full expanded menu ("all")
      if (lowerQuery === 'all') {
        const text = renderAllMenu({
          botName,
          botOwner,
          version,
          prefix,
          totalCommands,
          categories: activeCategories,
          mode,
          uptime,
          time,
          topCommands
        });
        return await sendMenu(sock, chatId, text, channelInfo, message);
      }

      // 3. Numbered category lookup (e.g. "1", "4", "1.")
      const cleanNum = lowerQuery.replace(/\.$/, '');
      if (/^\d+$/.test(cleanNum)) {
        const num = parseInt(cleanNum, 10);
        if (num >= 1 && num <= activeCategories.length) {
          const selected = activeCategories[num - 1];
          const text = renderCategoryMenu({
            botName,
            botOwner,
            version,
            prefix,
            categoryName: selected.name,
            commands: selected.commands,
            mode,
            uptime,
            time
          });
          return await sendMenu(sock, chatId, text, channelInfo, message);
        } else {
          const notFoundText = [
            `╭━━〔 ${botName} 〕━━⬣`,
            `┃ 🤖 Bot: ${botName}`,
            `┃ 👑 Owner: ${botOwner}`,
            `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
            `┃`,
            `┃ ❌ Category #${num} not found (choose 1-${activeCategories.length}).`,
            `┃`,
            `┃ 💡 ${prefix}menu — view category menu`,
            `╰━━━━━━━━━━━━━━⬣`
          ].join('\n');
          return await sendMenu(sock, chatId, notFoundText, channelInfo, message);
        }
      }

      // 4. Category name match (e.g. "admin", "download")
      const matchedCat = activeCategories.find(c => c.name.toLowerCase() === lowerQuery);
      const isHelpInvocation = context.commandName === 'help' || context.invokedCmd === 'help';

      if (matchedCat && !isHelpInvocation) {
        const text = renderCategoryMenu({
          botName,
          botOwner,
          version,
          prefix,
          categoryName: matchedCat.name,
          commands: matchedCat.commands,
          mode,
          uptime,
          time
        });
        return await sendMenu(sock, chatId, text, channelInfo, message);
      }

      // 5. Command lookup (e.g. "ping", "help ping", "info ping")
      let targetCmdName = lowerQuery;
      if ((lowerQuery.startsWith('help ') || lowerQuery.startsWith('info ')) && args.length > 1) {
        targetCmdName = args[1].toLowerCase();
      } else if (args.length > 0) {
        targetCmdName = args[0].toLowerCase();
      }

      let cmd = CommandHandler.commands.get(targetCmdName);
      if (!cmd && CommandHandler.aliases && CommandHandler.aliases.has(targetCmdName)) {
        const mainCommand = CommandHandler.aliases.get(targetCmdName);
        cmd = CommandHandler.commands.get(mainCommand);
      }

      if (cmd) {
        const text = renderCommandHelp({
          botName,
          botOwner,
          version,
          prefix,
          cmd
        });
        return await sendMenu(sock, chatId, text, channelInfo, message);
      }

      // If matchedCat existed but it was a help invocation and no command matched
      if (matchedCat) {
        const text = renderCategoryMenu({
          botName,
          botOwner,
          version,
          prefix,
          categoryName: matchedCat.name,
          commands: matchedCat.commands,
          mode,
          uptime,
          time
        });
        return await sendMenu(sock, chatId, text, channelInfo, message);
      }

      // 6. Not found - with suggestion if available
      const suggestion = typeof CommandHandler.findSuggestion === 'function' ? CommandHandler.findSuggestion(targetCmdName) : null;
      const text = renderNotFound({
        botName,
        botOwner,
        version,
        prefix,
        query: rawQuery,
        suggestion
      });
      return await sendMenu(sock, chatId, text, channelInfo, message);

    } catch (error) {
      console.error('Menu Error:', error);
      const errCard = [
        `╭━━〔 ${botName} 〕━━⬣`,
        `┃ 🤖 Bot: ${botName}`,
        `┃ 👑 Owner: ${botOwner}`,
        `┃ 💎 Version: ${version}  •  🔧 Prefix: ${prefix}`,
        `┃`,
        `┃ ❌ Error displaying menu: ${error.message}`,
        `┃`,
        `┃ 💡 Try ${prefix}menu again`,
        `╰━━━━━━━━━━━━━━⬣`
      ].join('\n');
      try {
        await sock.sendMessage(chatId, { text: errCard, ...channelInfo }, { quoted: message });
      } catch {}
    }
  }
};
