const settings = require('../settings');
const DIVIDER = '━━━━━━━━━━━━━';

module.exports = {
  command: 'repo',
  aliases: ['script', 'sc', 'github', 'git'],
  category: 'info',
  description: 'Get information and links for the official bot repository',
  usage: '.repo',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();
    const version = settings.version || '5.2.0';
    const channelLink = settings.channelLink || 'https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K';
    const repoTarget = 'pgwiz/pgwiz-md-litrop';
    const repoUrl = `https://github.com/${repoTarget}`;

    let repoData = {
      name: repoTarget,
      stars: '150+',
      forks: '420+',
      size: '12.4 MB',
      updated: 'Recently',
      url: repoUrl
    };

    try {
      const axios = require('axios');
      const res = await axios.get(`https://api.github.com/repos/${repoTarget}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'PGWIZ-MD' }
      });
      if (res.data) {
        repoData = {
          name: res.data.full_name || repoTarget,
          stars: String(res.data.stargazers_count ?? repoData.stars),
          forks: String(res.data.forks_count ?? repoData.forks),
          size: res.data.size ? `${(res.data.size / 1024).toFixed(1)} MB` : repoData.size,
          updated: res.data.updated_at ? new Date(res.data.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : repoData.updated,
          url: res.data.html_url || repoUrl
        };
      }
    } catch {
      // Use fallback metadata gracefully
    }

    const repoText = `*✩ ${botName} REPOSITORY ✩*
${DIVIDER}
📂 *Repository:* ${repoData.name}
⭐ *Stars:* ${repoData.stars}
🍴 *Forks:* ${repoData.forks}
📦 *Size:* ${repoData.size}
${DIVIDER}
🕐 *Updated:* ${repoData.updated}
🤖 *Version:* ${version}
${DIVIDER}`;

    const buttons = [
      {
        type: 'url',
        text: '📂 GitHub Repo',
        url: repoData.url
      },
      {
        type: 'url',
        text: '📢 Official Channel',
        url: channelLink
      },
      {
        type: 'url',
        text: '💬 Support Group',
        url: 'https://pgwiz.cloud'
      }
    ];

    try {
      if (typeof sock.sendButtons === 'function') {
        return await sock.sendButtons(chatId, {
          title: `*✩ ${botName} REPOSITORY ✩*`,
          text: repoText,
          footer: botName,
          buttons,
          ...channelInfo
        }, message);
      }
      return await sock.sendMessage(chatId, {
        text: repoText,
        buttons,
        footer: botName,
        ...channelInfo
      }, { quoted: message });
    } catch {
      return await sock.sendMessage(chatId, {
        text: repoText,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
