const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OPTIONAL_DIR = path.join(__dirname, '..', 'plugins-optional');
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

// List of core plugins that should not be removed
const CORE_PLUGINS = [
  'menu.js', 'update.js', 'updateforce.js', 'jid.js', 'gid.js', 'save.js',
  'pgvars.js', 'pgwavs.js', 'ping.js', 'alive.js', 'sudo.js', 'vvadmin.js',
  'installplugin.js', 'removeplugin.js', 'autoread.js', 'autotyping.js',
  'antidelete.js', 'antilink.js', 'antitag.js', 'antibadword.js', 'antiswear.js',
  'anticall.js', 'antifake.js', 'owner.js'
];

function extractCategory(source) {
  const match = source.match(/category\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (!match) return 'misc';
  return match[1].toLowerCase();
}

function extractCommand(source) {
  const match = source.match(/command\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

function buildPackIndex() {
  if (!fs.existsSync(OPTIONAL_DIR)) return null;
  const files = fs.readdirSync(OPTIONAL_DIR).filter(file => file.endsWith('.js'));
  const packs = {};
  const plugins = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(OPTIONAL_DIR, file), 'utf8');
      const category = extractCategory(content);
      const command = extractCommand(content);
      
      if (!packs[category]) packs[category] = [];
      packs[category].push({ file, command });
      
      if (command) {
        plugins[command] = { file, category };
      }
    } catch (e) {
      if (!packs.misc) packs.misc = [];
      packs.misc.push({ file, command: null });
    }
  }

  return { files, packs, plugins };
}

async function installPack(packName) {
  const index = buildPackIndex();
  if (!index) return { error: 'Optional plugin folder not found.' };

  const normalized = packName.toLowerCase();
  let filesToInstall = [];
  
  if (normalized === 'all') {
    filesToInstall = index.files;
  } else if (index.packs[normalized]) {
    filesToInstall = index.packs[normalized].map(p => p.file);
  }

  if (!filesToInstall || filesToInstall.length === 0) {
    return { error: `Unknown pack "${packName}".`, packs: Object.keys(index.packs) };
  }

  let installed = 0;
  let skipped = 0;

  for (const file of filesToInstall) {
    const src = path.join(OPTIONAL_DIR, file);
    const dest = path.join(PLUGINS_DIR, file);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    await fs.promises.copyFile(src, dest);
    installed++;
  }

  return { installed, skipped, total: filesToInstall.length, packs: Object.keys(index.packs) };
}

async function removePack(pluginName) {
  const file = pluginName.endsWith('.js') ? pluginName : pluginName + '.js';
  
  if (CORE_PLUGINS.includes(file)) {
    return { error: `Cannot remove core plugin: ${file}` };
  }

  const dest = path.join(PLUGINS_DIR, file);
  if (!fs.existsSync(dest)) {
    return { error: `Plugin not found: ${file}` };
  }

  try {
    fs.unlinkSync(dest);
    return { removed: true, file };
  } catch (e) {
    return { error: `Failed to remove plugin: ${e.message}` };
  }
}

module.exports = {
  command: 'addplugin',
  aliases: ['installplugin', 'install'],
  category: 'owner',
  description: 'Install plugins from optional directory or Gist URL',
  usage: '.addplugin [list|remove] [group|all] | .addplugin <pack:category|url>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    const cmd = args?.[0]?.toLowerCase();
    const arg2 = args?.[1]?.toLowerCase();
    const arg3 = args?.[2]?.toLowerCase();

    // Handle list commands
    if (cmd === 'list') {
      const index = buildPackIndex();
      if (!index) {
        return await sock.sendMessage(chatId, {
          text: 'Optional plugin folder not found.'
        }, { quoted: message });
      }

      // List groups
      if (arg2 === 'groups' || !arg2) {
        const groups = Object.keys(index.packs).sort();
        let text = '*📁 Available Plugin Groups:*\n\n';
        for (const group of groups) {
          const count = index.packs[group].length;
          text += `• *${group}* (${count} plugins)\n`;
        }
        text += '\n*Usage:* .addplugin list group <name> [all/10]\n.addplugin list all';
        return await sock.sendMessage(chatId, { text }, { quoted: message });
      }

      // List plugins in a group
      if (arg2 === 'group' && arg3) {
        const groupName = arg3;
        const group = index.packs[groupName];
        if (!group) {
          const groups = Object.keys(index.packs).sort();
          return await sock.sendMessage(chatId, {
            text: `Group not found. Available: ${groups.join(', ')}`
          }, { quoted: message });
        }

        const showAll = args?.[3]?.toLowerCase() === 'all';
        const limit = showAll ? group.length : 10;
        const shown = group.slice(0, limit);

        let text = `*📂 ${groupName.toUpperCase()} (${group.length} total)*\n\n`;
        for (const plugin of shown) {
          text += `• *${plugin.command || 'unknown'}* - ${plugin.file}\n`;
        }

        if (group.length > limit) {
          text += `\n... and ${group.length - limit} more\n`;
        }
        text += `\n*Install:* .addplugin pack:${groupName}`;

        return await sock.sendMessage(chatId, { text }, { quoted: message });
      }

      // List all plugins individually
      if (arg2 === 'all') {
        const allPlugins = Object.values(index.plugins);
        const limit = 15;
        const shown = allPlugins.slice(0, limit);

        let text = `*📦 All Available Plugins (${allPlugins.length} total)*\n\n`;
        for (const plugin of shown) {
          text += `• *${plugin.file.replace('.js', '')}* [${plugin.category}]\n`;
        }

        if (allPlugins.length > limit) {
          text += `\n... and ${allPlugins.length - limit} more\n`;
        }

        return await sock.sendMessage(chatId, { text }, { quoted: message });
      }
    }

    // Handle remove command
    if (cmd === 'remove') {
      if (!arg2) {
        return await sock.sendMessage(chatId, {
          text: 'Usage: .addplugin remove <plugin_name>'
        }, { quoted: message });
      }

      const result = await removePack(arg2);
      if (result.error) {
        return await sock.sendMessage(chatId, {
          text: `❌ ${result.error}`
        }, { quoted: message });
      }

      // Reload plugins
      try {
        const commandHandler = require('../lib/commandHandler');
        commandHandler.loadCommands();
      } catch (e) {
        console.error('Error reloading plugins:', e.message);
      }

      return await sock.sendMessage(chatId, {
        text: `✅ Removed plugin: ${result.file}\n🔄 Plugins reloaded!`
      }, { quoted: message });
    }

    // Default: install a plugin
    const text = args?.[0];
    if (!text) {
      return await sock.sendMessage(chatId, {
        text: 'Usage:\n.addplugin pack:<category|all>\n.addplugin list [groups|group <name> [all/10]|all]\n.addplugin remove <plugin_name>\n.addplugin <Gist URL>'
      }, { quoted: message });
    }

    const isPack =
      text.toLowerCase() === 'pack' ||
      text.toLowerCase() === 'packs' ||
      text.toLowerCase().startsWith('pack:') ||
      text.toLowerCase().startsWith('category:');

    if (isPack) {
      const packName = text.toLowerCase() === 'pack' || text.toLowerCase() === 'packs'
        ? (args?.[1] || '')
        : text.split(':').slice(1).join(':').trim();

      if (!packName) {
        const index = buildPackIndex();
        const available = index ? Object.keys(index.packs).sort().join(', ') : 'none';
        return await sock.sendMessage(chatId, {
          text: `Available packs: ${available}\n\nUse: .addplugin pack:<category|all>`
        }, { quoted: message });
      }

      const result = await installPack(packName);
      if (result.error) {
        return await sock.sendMessage(chatId, {
          text: `${result.error}\n\nAvailable packs: ${result.packs?.sort().join(', ') || 'none'}`
        }, { quoted: message });
      }

      // Reload plugins
      try {
        const commandHandler = require('../lib/commandHandler');
        commandHandler.loadCommands();
      } catch (e) {
        console.error('Error reloading plugins:', e.message);
      }

      return await sock.sendMessage(chatId, {
        text: `✅ Installed pack "${packName}".\n• Installed: ${result.installed}\n• Skipped: ${result.skipped}\n• Total: ${result.total}\n\n🔄 Plugins reloaded!`
      }, { quoted: message });
    }

    // Try Gist URL
    const gistMatch = text.match(/(?:\/|gist\.github\.com\/)([a-fA-F0-9]+)/);
    if (!gistMatch) {
      return await sock.sendMessage(chatId, {
        text: '❌ Invalid plugin URL.'
      }, { quoted: message });
    }

    const gistId = gistMatch[1];
    const gistURL = `https://api.github.com/gists/${gistId}`;

    try {
      const response = await axios.get(gistURL);
      const gistData = response.data;

      if (!gistData || !gistData.files) {
        return await sock.sendMessage(chatId, {
          text: '❌ No valid files found in the Gist.'
        }, { quoted: message });
      }

      for (const file of Object.values(gistData.files)) {
        const pluginName = file.filename;
        const pluginPath = path.join(PLUGINS_DIR, pluginName);
        await fs.promises.writeFile(pluginPath, file.content);
      }

      // Reload plugins
      try {
        const commandHandler = require('../lib/commandHandler');
        commandHandler.loadCommands();
      } catch (e) {
        console.error('Error reloading plugins:', e.message);
      }

      await sock.sendMessage(chatId, {
        text: '*✅ Successfully installed plugin from Gist.*\n🔄 Plugins reloaded!'
      }, { quoted: message });
    } catch (error) {
      console.error('install plugin error:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Error fetching or saving the plugin: ${error.message}`
      }, { quoted: message });
    }
  }
};

