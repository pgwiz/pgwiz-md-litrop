const { getAutoReactConfig, setAutoReactConfig, findSuitableEmoji } = require('../lib/reactions');

module.exports = {
  command: 'autoreact',
  aliases: ['areact', 'autoreaction'],
  category: 'owner',
  description: 'Toggle smart auto-reaction to incoming messages with suitable emojis',
  usage: '.autoreact on/off/dm/group/status [test <text>]',
  ownerOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const subCmd = (args[0] || '').toLowerCase().trim();

    // Current config
    const currentConfig = await getAutoReactConfig();

    if (!subCmd || subCmd === 'status') {
      const modeText = currentConfig.enabled
        ? `*ENABLED* (${currentConfig.mode.toUpperCase()})`
        : '*DISABLED*';

      return await sock.sendMessage(chatId, {
        text: `⚡ *Smart Auto-Reaction Settings*\n\n` +
          `• *Status:* ${modeText}\n` +
          `• *Active Scope:* ${currentConfig.mode || 'all'}\n\n` +
          `*Commands:*\n` +
          `• \`.autoreact on\` (React to all chats)\n` +
          `• \`.autoreact dm\` (React to Private/Inbox chats only)\n` +
          `• \`.autoreact group\` (React to Groups only)\n` +
          `• \`.autoreact off\` (Disable auto-react)\n` +
          `• \`.autoreact test <text>\` (Test suitable emoji preview)\n\n` +
          `_Smart AI-style sentiment matching is active!_`,
        ...channelInfo
      }, { quoted: message });
    }

    if (subCmd === 'test') {
      const sampleText = args.slice(1).join(' ').trim() || 'Hello friend, how are you?';
      const previewEmoji = findSuitableEmoji(sampleText);

      return await sock.sendMessage(chatId, {
        text: `🎯 *Reaction Preview*\n\n` +
          `• *Input:* "${sampleText}"\n` +
          `• *Matched Emoji:* ${previewEmoji}`,
        ...channelInfo
      }, { quoted: message });
    }

    if (['on', 'enable', 'all', '1', 'true'].includes(subCmd)) {
      await setAutoReactConfig({ enabled: true, mode: 'all' });
      return await sock.sendMessage(chatId, {
        text: `✅ *Auto-React ENABLED* (All Chats - DMs & Groups)\n\nThe bot will now react to incoming messages with contextually suitable emojis!`,
        ...channelInfo
      }, { quoted: message });
    }

    if (['dm', 'inbox', 'pm'].includes(subCmd)) {
      await setAutoReactConfig({ enabled: true, mode: 'dm' });
      return await sock.sendMessage(chatId, {
        text: `✅ *Auto-React ENABLED* (Private DMs / Inbox Only)\n\nThe bot will react to direct messages only.`,
        ...channelInfo
      }, { quoted: message });
    }

    if (['group', 'groups', 'gc'].includes(subCmd)) {
      await setAutoReactConfig({ enabled: true, mode: 'group' });
      return await sock.sendMessage(chatId, {
        text: `✅ *Auto-React ENABLED* (Groups Only)\n\nThe bot will react to group messages only.`,
        ...channelInfo
      }, { quoted: message });
    }

    if (['off', 'disable', '0', 'false'].includes(subCmd)) {
      await setAutoReactConfig({ enabled: false, mode: 'all' });
      return await sock.sendMessage(chatId, {
        text: `❌ *Auto-React DISABLED*\n\nThe bot will no longer auto-react to chat messages.`,
        ...channelInfo
      }, { quoted: message });
    }

    return await sock.sendMessage(chatId, {
      text: `*Usage:*\n.autoreact on / off / dm / group / status / test <text>`,
      ...channelInfo
    }, { quoted: message });
  }
};
