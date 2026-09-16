const settings = require('../settings');
// Lazy-loaded: const axios = require('axios');

const AXIOS_DEFAULTS = {
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*'
  }
};

module.exports = {
  command: 'facebook',
  aliases: ['fb', 'fbdl', 'fbvideo'],
  category: 'download',
  description: 'Download Facebook videos (fast SD/lowest stream)',
  usage: '.fb <facebook video link>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    let url = args[0];

    if (!url) {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text;
      if (quotedText) {
        const match = quotedText.match(/https?:\/\/[^\s]+/);
        if (match) url = match[0];
      }
    }

    if (!url || !/facebook\.com|fb\.watch/i.test(url)) {
      return await sock.sendMessage(chatId, {
        text: '📘 *Facebook Video Downloader*\n\n📌 Please provide a valid Facebook video link.\n\n*Usage:* `.fb https://fb.watch/xxxxxx/`'
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
      react: { text: '⏳', key: message.key }
    });

    let videoUrl = null;
    let resolution = 'Standard (SD)';

    // Engine 1: Gifted Tech FB Downloader
    try {
      const apiUrl = `https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(url)}`;
      const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
      const data = res?.data?.result;
      if (data) {
        videoUrl = data.sd || data.hd || data.url || (Array.isArray(data) ? data[0]?.url : null);
        if (data.sd) resolution = 'SD (Fast)';
      }
    } catch (_) {}

    // Engine 2: GuruAPI FB Downloader
    if (!videoUrl) {
      try {
        const apiUrl = `https://api.guruapi.tech/fb/v1/fbdl?url=${encodeURIComponent(url)}`;
        const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
        const data = res?.data;
        if (data?.result?.sd || data?.result?.hd) {
          videoUrl = data.result.sd || data.result.hd;
          resolution = data.result.sd ? 'SD (Fast)' : 'HD';
        }
      } catch (_) {}
    }

    // Engine 3: GTech fallback
    if (!videoUrl) {
      try {
        const apiUrl = `https://gtech-api-xtp1.onrender.com/api/download/fb?url=${encodeURIComponent(url)}&apikey=APIKEY`;
        const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
        const videos = res?.data?.data?.data;
        if (Array.isArray(videos) && videos.length) {
          // Sort ascending to get lowest / SD first for fast delivery
          const sorted = videos.sort((a, b) => (parseInt(a.resolution) || 0) - (parseInt(b.resolution) || 0));
          const selected = sorted[0];
          videoUrl = selected.url.startsWith('http') ? selected.url : `https://gtech-api-xtp1.onrender.com${selected.url}`;
          resolution = selected.resolution || 'SD';
        }
      } catch (_) {}
    }

    if (!videoUrl) {
      return await sock.sendMessage(chatId, {
        text: '❌ *Failed to download Facebook video.* The video may be private or unavailable.'
      }, { quoted: message });
    }

    try {
      const caption = `📘 *Facebook Downloader*\n🎞 *Quality:* ${resolution}\n\n> *_Downloaded by ${settings.botName || 'PGWIZ-MD'}*_`;

      await sock.sendMessage(chatId, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: message.key }
      });

    } catch (sendErr) {
      console.error('Facebook send error:', sendErr);
      await sock.sendMessage(chatId, {
        text: `❌ Error sending video: ${sendErr.message || 'Media stream error'}`
      }, { quoted: message });
    }
  }
};
