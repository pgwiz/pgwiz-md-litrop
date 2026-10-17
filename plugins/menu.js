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

function shouldShowTopCommands() {
  const envVal = (process.env.SHOW_TOP_COMMANDS || process.env.MENU_SHOW_TOP || '').toLowerCase().trim();
  if (['true', '1', 'yes'].includes(envVal)) return true;
  if (settings && (settings.showTopCommands === true || settings.menuShowTop === true)) return true;
  return false;
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

function buildHeader({ botName, prefix, totalCommands, totalCategories, mode, uptime, time, topCommands }) {
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃🔧 Prefix: ${prefix}`,
    `┃ 📂 Menu (${totalCategories})`,
    `┃ 📦 Commands: ${totalCommands} `,
    `┃ 🛠️ Mode: ${mode} `,
    `┃⏱️ Uptime: ${uptime} { ${time} }`
  ];
  if (shouldShowTopCommands() && topCommands) {
    lines.push(`┃ 🔥 Top: ${topCommands}`);
  }
  lines.push(`┃`);
  return lines;
}

function renderOverviewMenu({ botName, prefix, totalCommands, categories, mode, uptime, time, topCommands }) {
  const lines = buildHeader({
    botName,
    prefix,
    totalCommands,
    totalCategories: categories.length,
    mode,
    uptime,
    time,
    topCommands
  });

  lines.push(`┃📂 Categories(${categories.length})`);
  lines.push(`┃`);
  categories.forEach((cat, idx) => {
    const icon = getCategoryIcon(cat.name);
    lines.push(`┃  ${icon} ${idx + 1}. ${cat.name.toUpperCase()} (${cat.count})`);
  });

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu <number|name> — open a category`);
  lines.push(`┃ 🔍 ${prefix}menu <command> — command help`);
  lines.push(`╰━━━━━━━━━━━━━⬣`);
  lines.push(botName);

  return lines.join('\n');
}

function renderCategoryMenu({ botName, prefix, categoryName, commands, mode, uptime, time }) {
  const icon = getCategoryIcon(categoryName);
  const count = commands.length;
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃🔧 Prefix: ${prefix}`,
    `┃ 📂 Category: ${icon} ${categoryName.toUpperCase()} (${count})`,
    `┃ 🛠️ Mode: ${mode}`,
    `┃⏱️ Uptime: ${uptime} { ${time} }`,
    `┃`
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
  lines.push(`╰━━━━━━━━━━━━━⬣`);
  lines.push(botName);

  return lines.join('\n');
}

function renderCommandHelp({ botName, prefix, cmd }) {
  const isOff = CommandHandler.disabledCommands && CommandHandler.disabledCommands.has(cmd.command.toLowerCase());
  const icon = getCategoryIcon(cmd.category);
  const usageText = cmd.usage
    ? cmd.usage.replace(/^[.!/#_]/, prefix)
    : `${prefix}${cmd.command}`;
  const aliasesText = (cmd.aliases && Array.isArray(cmd.aliases) && cmd.aliases.length)
    ? cmd.aliases.map(a => `${prefix}${a}`).join(', ')
    : 'None';

  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃🔧 Prefix: ${prefix}`,
    `┃`,
    `┃ ⚡ Command: ${prefix}${cmd.command}`,
    `┃ 📝 Description: ${cmd.description || 'No description provided'}`,
    `┃ 📖 Usage: ${usageText}`,
    `┃ 🏷️ Category: ${icon} ${(cmd.category || 'general').toUpperCase()}`,
    `┃ 🔖 Aliases: ${aliasesText}`
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
  lines.push(`╰━━━━━━━━━━━━━⬣`);
  lines.push(botName);

  return lines.join('\n');
}

function renderAllMenu({ botName, prefix, totalCommands, categories, mode, uptime, time, topCommands }) {
  const lines = buildHeader({
    botName,
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
  lines.push(`╰━━━━━━━━━━━━━⬣`);
  lines.push(botName);

  return lines.join('\n');
}

function renderNotFound({ botName, prefix, query, suggestion }) {
  const lines = [
    `╭━━〔 ${botName} 〕━━⬣`,
    `┃🔧 Prefix: ${prefix}`,
    `┃`,
    `┃ ❌ Command or category "${query}" not found.`
  ];

  if (suggestion) {
    lines.push(`┃ 💡 Did you mean: ${suggestion}`);
  }

  lines.push(`┃`);
  lines.push(`┃ 💡 ${prefix}menu — view category menu`);
  lines.push(`┃ 🔍 ${prefix}menu <command> — command help`);
  lines.push(`╰━━━━━━━━━━━━━⬣`);
  lines.push(botName);

  return lines.join('\n');
}

async function sendMenu(sock, chatId, text, channelInfo, message, botName) {
  const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
  if (fs.existsSync(imagePath) && text.length <= 1024) {
    try {
      return await sock.sendMessage(chatId, {
        image: { url: imagePath },
        caption: text,
        footer: botName,
        ...channelInfo
      }, { quoted: message });
    } catch {}
  }

  return await sock.sendMessage(chatId, {
    text,
    footer: botName,
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

      // Build sorted active categories with alphabetically sorted commands
      const rawCategories = Array.from(CommandHandler.categories.keys()).sort();
      const activeCategories = [];
      for (const cat of rawCategories) {
        const cmds = CommandHandler.getCommandsByCategory(cat);
        if (cmds && cmds.length > 0) {
          activeCategories.push({
            name: cat,
            count: cmds.length,
            commands: [...cmds].sort()
          });
        }
      }

      // Process and sanitize input arguments
      let rawQuery = (args && args.length) ? args.join(' ').trim() : '';

      // Strip enclosing markdown, brackets, or quotes (e.g. [1], "admin", *1*, `ping`)
      rawQuery = rawQuery.replace(/^[(\["'*_`]+|[)\]"'*_`]+$/g, '').trim();

      // Strip leading plus or hash if passed (e.g. +1, #1, + 1, # 1)
      if (/^[+#]\s*/.test(rawQuery)) {
        rawQuery = rawQuery.replace(/^[+#]\s*/, '').trim();
      }

      // Strip category word prefix if passed (e.g. "cat admin", "category 1")
      if (/^(cat|category)\s+/i.test(rawQuery)) {
        rawQuery = rawQuery.replace(/^(cat|category)\s+/i, '').trim();
      }

      // 1. Overview menu when no query is passed
      if (!rawQuery) {
        const text = renderOverviewMenu({
          botName,
          prefix,
          totalCommands,
          categories: activeCategories,
          mode,
          uptime,
          time,
          topCommands
        });
        return await sendMenu(sock, chatId, text, channelInfo, message, botName);
      }

      const lowerQuery = rawQuery.toLowerCase();

      // 2. Full expanded menu ("all")
      if (lowerQuery === 'all') {
        const text = renderAllMenu({
          botName,
          prefix,
          totalCommands,
          categories: activeCategories,
          mode,
          uptime,
          time,
          topCommands
        });
        return await sendMenu(sock, chatId, text, channelInfo, message, botName);
      }

      // 3. Numbered category lookup (e.g. "1", "1.", "1. ADMIN", "1 ADMIN", "1 - admin", "1. admin (22)")
      let catNumber = null;
      const numMatch = lowerQuery.match(/^(\d+)(?:\.|\s+|-|\s*\()/);
      if (numMatch) {
        catNumber = parseInt(numMatch[1], 10);
      } else if (/^\d+$/.test(lowerQuery)) {
        catNumber = parseInt(lowerQuery, 10);
      }

      if (catNumber !== null) {
        if (catNumber >= 1 && catNumber <= activeCategories.length) {
          const selected = activeCategories[catNumber - 1];
          const text = renderCategoryMenu({
            botName,
            prefix,
            categoryName: selected.name,
            commands: selected.commands,
            mode,
            uptime,
            time
          });
          return await sendMenu(sock, chatId, text, channelInfo, message, botName);
        } else {
          const notFoundText = [
            `╭━━〔 ${botName} 〕━━⬣`,
            `┃🔧 Prefix: ${prefix}`,
            `┃`,
            `┃ ❌ Category #${catNumber} not found (choose 1-${activeCategories.length}).`,
            `┃`,
            `┃ 💡 ${prefix}menu — view category menu`,
            `╰━━━━━━━━━━━━━⬣`,
            botName
          ].join('\n');
          return await sendMenu(sock, chatId, notFoundText, channelInfo, message, botName);
        }
      }

      // 4. Category name match (e.g. "admin", "download", "admin (22)")
      const cleanCatQuery = lowerQuery.replace(/\s*\(\d+\)$/, '').trim();
      const matchedCat = activeCategories.find(c => c.name.toLowerCase() === cleanCatQuery);
      const isHelpInvocation = context.commandName === 'help' || context.invokedCmd === 'help';

      if (matchedCat && !isHelpInvocation) {
        const text = renderCategoryMenu({
          botName,
          prefix,
          categoryName: matchedCat.name,
          commands: matchedCat.commands,
          mode,
          uptime,
          time
        });
        return await sendMenu(sock, chatId, text, channelInfo, message, botName);
      }

      // 5. Command lookup (e.g. "ping", ".ping", "!ping", "help ping", "info ping")
      let targetCmdName = lowerQuery;
      if ((lowerQuery.startsWith('help ') || lowerQuery.startsWith('info ')) && args.length > 1) {
        targetCmdName = args[1].toLowerCase();
      } else if (args.length > 0) {
        targetCmdName = args[0].toLowerCase();
      }

      // Strip leading command prefixes (e.g. ".ping", "!ping", "/ping" -> "ping")
      targetCmdName = targetCmdName.replace(/^[.!/#_+]+/, '').trim();

      let cmd = CommandHandler.commands.get(targetCmdName);
      if (!cmd && CommandHandler.aliases && CommandHandler.aliases.has(targetCmdName)) {
        const mainCommand = CommandHandler.aliases.get(targetCmdName);
        cmd = CommandHandler.commands.get(mainCommand);
      }

      if (cmd) {
        const text = renderCommandHelp({
          botName,
          prefix,
          cmd
        });
        return await sendMenu(sock, chatId, text, channelInfo, message, botName);
      }

      // If matchedCat existed but it was a help invocation and no command matched
      if (matchedCat) {
        const text = renderCategoryMenu({
          botName,
          prefix,
          categoryName: matchedCat.name,
          commands: matchedCat.commands,
          mode,
          uptime,
          time
        });
        return await sendMenu(sock, chatId, text, channelInfo, message, botName);
      }

      // 6. Not found - with suggestion if available (checking commands, aliases, and categories)
      let suggestion = null;
      if (typeof CommandHandler.findSuggestion === 'function') {
        const cmdSug = CommandHandler.findSuggestion(targetCmdName);
        if (cmdSug) {
          suggestion = `${prefix}${cmdSug}`;
        }
      }

      if (!suggestion) {
        const catNames = activeCategories.map(c => c.name.toLowerCase());
        for (const catName of catNames) {
          if (CommandHandler._levenshtein && CommandHandler._levenshtein(cleanCatQuery, catName) <= 2) {
            suggestion = `${prefix}menu ${catName}`;
            break;
          }
        }
      }

      const text = renderNotFound({
        botName,
        prefix,
        query: rawQuery,
        suggestion
      });
      return await sendMenu(sock, chatId, text, channelInfo, message, botName);

    } catch (error) {
      console.error('Menu Error:', error);
      const errCard = [
        `╭━━〔 ${botName} 〕━━⬣`,
        `┃🔧 Prefix: ${prefix}`,
        `┃`,
        `┃ ❌ Error displaying menu: ${error.message}`,
        `┃`,
        `┃ 💡 Try ${prefix}menu again`,
        `╰━━━━━━━━━━━━━⬣`,
        botName
      ].join('\n');
      try {
        await sock.sendMessage(chatId, { text: errCard, footer: botName, ...channelInfo }, { quoted: message });
      } catch {}
    }
  }
};
