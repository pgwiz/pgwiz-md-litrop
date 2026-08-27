const { performHotReload } = require('./update');

module.exports = {
  command: 'reload',
  aliases: ['refresh', 'reloadplugins', 'hotreload'],
  category: 'owner',
  description: 'Hot-reload all plugins and handlers in memory without restarting',
  usage: '.reload',
  ownerOnly: true,
  
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const start = Date.now();
    
    try {
      const count = performHotReload ? performHotReload() : 0;
      const duration = Date.now() - start;
      
      await sock.sendMessage(chatId, {
        text: `⚡ *Hot Reload Complete!*\n\n🔄 Refreshed ${count} modules in ${duration}ms\n🌐 WebSocket connection: *Active* (Zero Downtime)`,
        ...channelInfo
      }, { quoted: message });
    } catch (err) {
      await sock.sendMessage(chatId, {
        text: `❌ Hot reload failed: ${err.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
