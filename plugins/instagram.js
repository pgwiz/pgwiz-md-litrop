// Lazy-loaded: const axios = require('axios');
const settings = require('../settings');

module.exports = {
  command: 'instagram',
  aliases: ['ig', 'insta', 'igdl', 'instadl', 'reels', 'reel'],
  category: 'download',
  description: 'Download Instagram posts, reels, stories, or carousel albums',
  usage: '.instagram <Instagram URL>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};

    let text = args.join(' ').trim();
    if (!text) {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text;
      if (quotedText) {
        const match = quotedText.match(/https?:\/\/[^\s]+/);
        if (match) text = match[0];
      }
    }

    if (!text) {
      return await sock.sendMessage(
        chatId,
        {
          text: '📸 *Instagram Downloader*\n\n📌 Please provide an Instagram post or reel link.\n\n*Usage:* `.instagram https://www.instagram.com/reel/...`\n*Aliases:* `.ig`, `.insta`, `.reels`',
          ...channelInfo
        },
        { quoted: message }
      );
    }

    const igRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv|stories)\/[A-Za-z0-9_-]+/i;
    if (!igRegex.test(text)) {
      return await sock.sendMessage(
        chatId,
        {
          text: '❌ *Invalid Instagram link!* Supported formats: posts, reels, tv, stories.',
          ...channelInfo
        },
        { quoted: message }
      );
    }

    await sock.sendMessage(
      chatId,
      { react: { text: '⏳', key: message.key } }
    );

    let mediaList = [];

    // Engine 1: Gifted Tech Instagram API
    try {
      const apiUrl = `https://api.giftedtech.web.id/api/download/instagram?apikey=gifted&url=${encodeURIComponent(text)}`;
      const { data } = await axios.get(apiUrl, { timeout: 25000 });

      if (data && data.status === 200 && data.result) {
        if (Array.isArray(data.result)) {
          mediaList = data.result;
        } else if (typeof data.result === 'string') {
          mediaList = [{ url: data.result, type: 'video' }];
        } else if (data.result.url) {
          mediaList = [data.result];
        }
      }
    } catch (_) {}

    // Engine 2: GuruAPI Instagram API
    if (!mediaList || mediaList.length === 0) {
      try {
        const apiUrl = `https://api.guruapi.tech/insta/v1/igdl?url=${encodeURIComponent(text)}`;
        const { data } = await axios.get(apiUrl, { timeout: 25000 });
        if (data?.media && Array.isArray(data.media)) {
          mediaList = data.media.map(m => ({ url: m.url, type: m.type || 'video' }));
        }
      } catch (_) {}
    }

    if (!mediaList || mediaList.length === 0) {
      return await sock.sendMessage(
        chatId,
        { text: '❌ No downloadable media found. The account or post may be private.', ...channelInfo },
        { quoted: message }
      );
    }

    try {
      for (let i = 0; i < mediaList.length; i++) {
        const media = mediaList[i];
        const url = media.url || media;

        const isVideo =
          media.type === 'video' ||
          /\.(mp4|mov|webm|mkv)$/i.test(url) ||
          text.includes('/reel/') ||
          text.includes('/tv/');

        const caption = `📸 *Instagram Downloader*\n📥 *Downloaded by ${settings.botName || 'PGWIZ-MD'}*`;

        if (isVideo) {
          await sock.sendMessage(
            chatId,
            {
              video: { url },
              mimetype: 'video/mp4',
              caption,
              ...channelInfo
            },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(
            chatId,
            {
              image: { url },
              caption,
              ...channelInfo
            },
            { quoted: message }
          );
        }

        if (i < mediaList.length - 1) {
          await new Promise(r => setTimeout(r, 800));
        }
      }

      await sock.sendMessage(
        chatId,
        { react: { text: '✅', key: message.key } }
      );

    } catch (err) {
      console.error('Instagram download error:', err);
      await sock.sendMessage(
        chatId,
        { text: '❌ Failed to send Instagram media. Please try again later.', ...channelInfo },
        { quoted: message }
      );
    }
  }
};
