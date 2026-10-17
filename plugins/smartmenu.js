const menuPlugin = require('./menu');

module.exports = {
  command: 'smenu',
  aliases: ['shelp', 'smart', 'smartmenu'],
  category: 'general',
  description: 'Interactive clean menu with live status and command list',
  usage: '.smenu [category|command|number|all]',
  isPrefixless: true,

  async handler(sock, message, args = [], context = {}) {
    return await menuPlugin.handler(sock, message, args, context);
  }
};
