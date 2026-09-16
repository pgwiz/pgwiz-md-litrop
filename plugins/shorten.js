// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'shorten',
  aliases: ['short', 'tinyurl', 'isgd', 'shortlink'],
  category: 'tools',
  description: 'Shorten a long URL into a compact link',
  usage: '.shorten <url>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    let url = args[0];

    if (!url) {
      // Check if replying to a message containing a URL
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text;
      if (quotedText) {
        const match = quotedText.match(/https?:\/\/[^\s]+/);
        if (match) url = match[0];
      }
    }

    if (!url) {
      return await sock.sendMessage(chatId, {
        text: '🔗 *URL Shortener*\n\n📌 Please provide a URL to shorten.\n\n*Usage:* `.shorten https://example.com/very/long/url`\n*Aliases:* `.short`, `.tinyurl`, `.isgd`'
      }, { quoted: message });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    await sock.sendMessage(chatId, {
      react: { text: '✂️', key: message.key }
    });

    let shortUrl = null;
    let provider = '';

    // Primary: TinyURL
    try {
      const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
        timeout: 10000
      });
      if (res.data && res.data.startsWith('http')) {
        shortUrl = res.data.trim();
        provider = 'TinyURL';
      }
    } catch (_) {}

    // Fallback: is.gd
    if (!shortUrl) {
      try {
        const res = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, {
          timeout: 10000
        });
        if (res.data && res.data.startsWith('http')) {
          shortUrl = res.data.trim();
          provider = 'is.gd';
        }
      } catch (_) {}
    }

    // Fallback: cleanuri
    if (!shortUrl) {
      try {
        const res = await axios.post('https://cleanuri.com/api/v1/shorten', `url=${encodeURIComponent(url)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        });
        if (res.data?.result_url) {
          shortUrl = res.data.result_url;
          provider = 'CleanURI';
        }
      } catch (_) {}
    }

    if (!shortUrl) {
      return await sock.sendMessage(chatId, {
        text: '❌ *Error:* Failed to shorten URL. The link may be invalid or shortener services are unavailable.'
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
      text: `🔗 *Link Shortened Successfully*\n\n` +
            `*Original:* ${url}\n` +
            `*Short Link:* ${shortUrl}\n` +
            `*Service:* ${provider}\n\n` +
            `> Powered by MEGA-MD`
    }, { quoted: message });

    await sock.sendMessage(chatId, {
      react: { text: '✅', key: message.key }
    });
  }
};
