const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

// List of core plugins that should not be removed
const CORE_PLUGINS = [
  'menu.js', 'update.js', 'updateforce.js', 'jid.js', 'gid.js', 'save.js',
  'pgvars.js', 'pgwavs.js', 'ping.js', 'alive.js', 'sudo.js', 'vvadmin.js',
  'installplugin.js', 'removeplugin.js', 'autoread.js', 'autotyping.js',
  'antidelete.js', 'antilink.js', 'antitag.js', 'antibadword.js', 'antiswear.js',
  'anticall.js', 'antifake.js', 'owner.js'
];

module.exports = {
  command: 'removeplugin',
  aliases: ['uninstall', 'delplugin'],
  category: 'owner',
  description: 'Remove an installed plugin',
  usage: '.removeplugin <plugin_name>',
  ownerOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    const pluginName = args?.[0];
    if (!pluginName) {
      return await sock.sendMessage(chatId, {
        text: '❌ Usage: .removeplugin <plugin_name>\n\nExample: .removeplugin ai'
      }, { quoted: message });
    }

    const file = pluginName.endsWith('.js') ? pluginName : pluginName + '.js';

    // Check if it's a core plugin
    if (CORE_PLUGINS.includes(file)) {
      return await sock.sendMessage(chatId, {
        text: `❌ Cannot remove core plugin: *${file}*\n\nCore plugins are essential for bot functionality.`
      }, { quoted: message });
    }

    const pluginPath = path.join(PLUGINS_DIR, file);

    // Check if plugin exists
    if (!fs.existsSync(pluginPath)) {
      return await sock.sendMessage(chatId, {
        text: `❌ Plugin not found: *${file}*`
      }, { quoted: message });
    }

    try {
      fs.unlinkSync(pluginPath);

      // Reload plugins
      try {
        const commandHandler = require('../lib/commandHandler');
        commandHandler.loadCommands();
      } catch (e) {
        console.error('Error reloading plugins:', e.message);
      }

      await sock.sendMessage(chatId, {
        text: `✅ Successfully removed: *${file}*\n🔄 Plugins reloaded!`
      }, { quoted: message });
    } catch (error) {
      console.error('Error removing plugin:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Failed to remove plugin: ${error.message}`
      }, { quoted: message });
    }
  }
};
