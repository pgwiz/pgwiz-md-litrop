const path = require('path');
const fs = require('fs');

const CORE_PLUGINS = [
  'menu.js', 'list.js', 'update.js', 'ping.js', 'alive.js', 'delplugin.js',
  'installplugin.js', 'autoread.js', 'autotyping.js', 'antidelete.js',
  'antilink.js', 'antitag.js', 'anticall.js', 'owner.js', 'sudo.js',
  'system.js', 'settings.js'
];

module.exports = {
  command: 'delplugin',
  aliases: ['deleteplugin', 'rmplugin', 'removeplugin', 'uninstall'],
  category: 'owner',
  description: 'Delete/uninstall a plugin by name (owner only)',
  usage: '.delplugin <plugin_name>',
  ownerOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const pluginArg = args && args[0] ? args[0].trim() : '';
      if (!pluginArg) {
        return await sock.sendMessage(chatId, { 
          text: '❌ *Usage:* `.delplugin <plugin_name>`\n\n*Example:* `.delplugin sample`' 
        }, { quoted: message });
      }

      const pluginDir = path.join(__dirname, '..', 'plugins');
      const filename = pluginArg.endsWith('.js') ? pluginArg : `${pluginArg}.js`;
      const baseName = filename.replace(/\.js$/, '');

      if (CORE_PLUGINS.includes(filename) || CORE_PLUGINS.includes(`${baseName}.js`)) {
        return await sock.sendMessage(chatId, {
          text: `🛡️ *Protected Plugin:*\nCannot remove core system plugin: *${filename}*`
        }, { quoted: message });
      }

      const filePath = path.join(pluginDir, filename);
      if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(chatId, {
          text: `🗃️ Plugin *${filename}* does not exist.`
        }, { quoted: message });
      }

      fs.unlinkSync(filePath);

      // Attempt hot-reload if available
      try {
        const commandHandler = require('../lib/commandHandler');
        if (typeof commandHandler.loadCommands === 'function') {
          commandHandler.loadCommands();
        } else if (typeof commandHandler.reloadCommands === 'function') {
          commandHandler.reloadCommands();
        }
      } catch (reloadErr) {
        console.warn('Plugin reload notice:', reloadErr.message);
      }

      await sock.sendMessage(chatId, { 
        text: `🗑️ *Plugin Deleted:*\nPlugin \`${filename}\` has been removed and commands reloaded.` 
      }, { quoted: message });

    } catch (err) {
      console.error('delplugin error:', err);
      await sock.sendMessage(chatId, { 
        text: `❌ Failed to delete plugin: ${err.message}` 
      }, { quoted: message });
    }
  }
};
