const axios = require('axios');
let yts;
try { yts = require('yt-search'); } catch { try { yts = require('youtube-yts'); } catch {} }

const API_BASE = 'https://ytsp-api.pgwiz.cloud';
const AXIOS_TIMEOUT = 120000;

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

module.exports = {
  command: 'video',
  aliases: ['ytmp4', 'ytvideo', 'ytdl', 'ytvid'],
  category: 'download',
  description: 'Download YouTube videos in high quality by search or link',
  usage: '.video <youtube link | search query> [360p|720p]',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const rawQuery = args.join(' ').trim();

    if (!rawQuery) {
      return await sock.sendMessage(chatId, {
        text: '🎥 *YouTube Video Downloader*\n\nUsage:\n• `.video <song/video title>`\n• `.video <youtube link>`\n• `.video <link> 720p`'
      }, { quoted: message });
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

      let targetQuality = '360p';
      let cleanQuery = rawQuery;

      if (rawQuery.endsWith('720p') || rawQuery.endsWith('720')) {
        targetQuality = '720p';
        cleanQuery = rawQuery.replace(/720p?$/i, '').trim();
      } else if (rawQuery.endsWith('360p') || rawQuery.endsWith('360')) {
        targetQuality = '360p';
        cleanQuery = rawQuery.replace(/360p?$/i, '').trim();
      }

      let videoId = null;
      let videoTitle = '';
      let videoThumbnail = '';
      let videoDuration = 'N/A';
      let directUrl = '';

      if (cleanQuery.match(/^https?:\/\//i)) {
        directUrl = cleanQuery;
        videoId = extractYouTubeId(cleanQuery);
      } else {
        if (yts) {
          try {
            const res = await yts(cleanQuery);
            if (res && res.videos && res.videos.length > 0) {
              const top = res.videos[0];
              videoId = top.videoId;
              videoTitle = top.title;
              videoThumbnail = top.thumbnail;
              videoDuration = top.timestamp || top.duration?.toString();
              directUrl = top.url;
            }
          } catch {}
        }
      }

      if (!videoId && !directUrl) {
        return await sock.sendMessage(chatId, {
          text: '❌ *No video found!* Please check your search term or link.'
        }, { quoted: message });
      }

      // Fetch video stream from YTSP
      let streamMeta = null;
      if (videoId) {
        try {
          const res = await axios.get(`${API_BASE}/stream/${videoId}`, {
            params: { quality: targetQuality },
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.data) streamMeta = res.data;
        } catch {}
      }

      if (!streamMeta && directUrl) {
        try {
          const res = await axios.get(`${API_BASE}/get`, {
            params: { ytl: directUrl, quality: targetQuality },
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.data) streamMeta = res.data;
        } catch {}
      }

      if (!streamMeta) {
        throw new Error('Could not extract video stream from media server');
      }

      const finalTitle = streamMeta.title || videoTitle || 'Video';
      const finalThumbnail = streamMeta.thumbnail || videoThumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
      const finalDuration = streamMeta.duration || videoDuration;
      let proxyUrl = streamMeta.proxy_url || streamMeta.streamUrl || streamMeta.url;

      if (!proxyUrl) {
        throw new Error('No download stream available');
      }
      if (!proxyUrl.startsWith('http')) proxyUrl = `${API_BASE}${proxyUrl}`;

      // Notify downloading
      await sock.sendMessage(chatId, {
        text: `🎬 *${finalTitle}*\n⏳ Downloading video (${targetQuality})...`,
        contextInfo: {
          externalAdReply: {
            title: finalTitle,
            body: `Duration: ${finalDuration} • Quality: ${targetQuality}`,
            thumbnailUrl: finalThumbnail,
            sourceUrl: directUrl || `https://youtube.com/watch?v=${videoId}`,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '⬇️', key: message.key } });

      const videoBuffer = await axios.get(proxyUrl, {
        responseType: 'arraybuffer',
        timeout: AXIOS_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': API_BASE
        }
      });

      await sock.sendMessage(chatId, { react: { text: '⬆️', key: message.key } });

      // Send Video
      await sock.sendMessage(chatId, {
        video: videoBuffer.data,
        mimetype: 'video/mp4',
        fileName: `${finalTitle}.mp4`,
        caption: `🎬 *${finalTitle}*\n⏱️ *Duration:* ${finalDuration}\n🎥 *Quality:* ${targetQuality}\n\n> *Downloaded via MEGA-MD*`
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
      console.error('Video download error:', error);
      await sock.sendMessage(chatId, {
        text: `❌ *Download failed!*\n\nReason: ${error.message || 'Service unavailable'}\n\nPlease try again later.`
      }, { quoted: message });
    }
  }
};
