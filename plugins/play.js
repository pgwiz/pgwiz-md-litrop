const axios = require('axios');
let yts;
try { yts = require('yt-search'); } catch { try { yts = require('youtube-yts'); } catch {} }

const API_BASE = 'https://ytsp-api.pgwiz.cloud';
const AXIOS_TIMEOUT = 60000;

function cleanFileName(str) {
  return (str || 'song').replace(/[\\/:*?"<>|]/g, '').trim();
}

async function requestPackagedMp3(url, title, artist, thumbnail) {
  try {
    const res = await axios.post(`${API_BASE}/download`, {
      url,
      title: title || 'Song',
      artist: artist || 'Artist',
      thumbnail: thumbnail || ''
    }, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.data?.files && res.data.files.length > 0 && res.data.files[0].download_url) {
      let downloadUrl = res.data.files[0].download_url;
      if (!downloadUrl.startsWith('http')) {
        downloadUrl = `${API_BASE}${downloadUrl}`;
      }
      return {
        downloadUrl,
        filename: res.data.files[0].name || `${cleanFileName(title)}.mp3`,
        size: res.data.files[0].size
      };
    }
  } catch (err) {}
  return null;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

module.exports = {
  command: 'play',
  aliases: ['plays', 'music', 'ytplay'],
  category: 'music',
  description: 'Instantly play any song from YouTube or Spotify',
  usage: '.play <song name | youtube / spotify link>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const rawQuery = args.join(' ').trim();

    if (!rawQuery) {
      return await sock.sendMessage(chatId, {
        text: '🎵 *Instant Music Player*\n\nUsage:\n• `.play <song name>` (Ultra-fast, lowest data)\n• `.play <song name> hd` (High quality)\n• `.play <youtube or spotify link>`'
      }, { quoted: message });
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

      const isHd = /\b(hd|high|320k?)\b/i.test(rawQuery);
      const query = rawQuery.replace(/\b(hd|high|320k?)\b/gi, '').trim();
      const targetQuality = isHd ? 'audio_high' : 'saver';

      let targetVideoId = null;
      let targetTitle = '';
      let targetThumbnail = '';
      let targetDuration = 'N/A';
      let targetUploader = '';
      let directUrl = '';

      if (query.match(/^https?:\/\//i)) {
        directUrl = query;
        targetVideoId = extractYouTubeId(query);
      } else {
        // Search using yt-search
        if (yts) {
          try {
            const res = await yts(query);
            if (res && res.videos && res.videos.length > 0) {
              const top = res.videos[0];
              targetVideoId = top.videoId;
              targetTitle = top.title;
              targetThumbnail = top.thumbnail;
              targetDuration = top.timestamp || top.duration?.toString();
              targetUploader = top.author?.name || '';
              directUrl = top.url;
            }
          } catch {}
        }

        // Fallback to YTSP Search API
        if (!targetVideoId) {
          const searchRes = await axios.get(`${API_BASE}/api/search/youtube`, {
            params: { query: query, limit: 1 },
            timeout: 10000
          });
          const top = searchRes.data?.results?.[0];
          if (top) {
            targetVideoId = top.id || top.videoId;
            targetTitle = top.title || top.name;
            targetThumbnail = top.thumbnail;
            targetDuration = top.duration || top.duration_string;
            directUrl = top.url;
          }
        }
      }

      if (!targetVideoId && !directUrl) {
        return await sock.sendMessage(chatId, {
          text: '❌ *No song found!* Please try a different title.'
        }, { quoted: message });
      }

      // Fetch audio stream metadata from YTSP (lowest quality default)
      let streamMeta = null;
      if (targetVideoId && !directUrl.includes('spotify.com')) {
        try {
          const res = await axios.get(`${API_BASE}/stream/${targetVideoId}`, {
            params: { quality: targetQuality },
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.data) streamMeta = res.data;
        } catch {}
      }

      if (!streamMeta && directUrl) {
        try {
          const res = await axios.get(`${API_BASE}/get`, {
            params: { ytl: directUrl, quality: targetQuality },
            timeout: 25000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.data) {
            if (res.data.tracks && res.data.tracks.length > 0) {
              const track = res.data.tracks[0];
              const tId = track.videoId || track.id;
              if (tId && !directUrl.includes('spotify.com')) {
                const sRes = await axios.get(`${API_BASE}/stream/${tId}`, {
                  params: { quality: targetQuality },
                  timeout: 15000
                });
                if (sRes.data) streamMeta = sRes.data;
              } else {
                streamMeta = track;
              }
            } else {
              streamMeta = res.data;
            }
          }
        } catch {}
      }

      // Secondary fallback: GiftedTech / Vreden free endpoints if primary extractor is down
      if (!streamMeta) {
        try {
          const fallbackRes = await axios.get(`https://api.vreden.my.id/api/ytplay?query=${encodeURIComponent(query)}`, { timeout: 15000 });
          if (fallbackRes.data?.result?.download?.url) {
            streamMeta = {
              title: fallbackRes.data.result.title || targetTitle,
              uploader: fallbackRes.data.result.author?.name || targetUploader,
              duration: fallbackRes.data.result.timestamp || targetDuration,
              thumbnail: fallbackRes.data.result.thumbnail || targetThumbnail,
              url: fallbackRes.data.result.download.url
            };
          }
        } catch {}
      }

      if (!streamMeta) {
        throw new Error('Could not extract stream from media server');
      }

      const finalTitle = streamMeta.title || targetTitle || 'Playing Track';
      const finalThumbnail = streamMeta.thumbnail || targetThumbnail || (targetVideoId ? `https://img.youtube.com/vi/${targetVideoId}/mqdefault.jpg` : '');
      const finalUploader = streamMeta.uploader || streamMeta.artist || targetUploader || 'Artist';
      const finalDuration = streamMeta.duration || streamMeta.duration_string || targetDuration;
      let proxyUrl = streamMeta.proxy_url || streamMeta.streamUrl || streamMeta.url;

      if (!proxyUrl) {
        throw new Error('No audio stream link available');
      }
      if (!proxyUrl.startsWith('http')) proxyUrl = `${API_BASE}${proxyUrl}`;

      // Notify downloading
      await sock.sendMessage(chatId, {
        text: `🎵 *${finalTitle}*\n⚡ *Quality:* ${isHd ? 'High Definition (HD)' : 'Fast Stream (Lowest Bitrate)'}\n⏳ Streaming to WhatsApp...`,
        contextInfo: {
          externalAdReply: {
            title: finalTitle,
            body: `${finalUploader} • ${finalDuration}`,
            thumbnailUrl: finalThumbnail,
            sourceUrl: directUrl || (targetVideoId ? `https://youtube.com/watch?v=${targetVideoId}` : API_BASE),
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '⬇️', key: message.key } });

      let audioData = null;
      let finalFileName = `${cleanFileName(finalTitle)}.mp3`;

      // 1. Primary: Server-side packaged MP3 (dae7d757 standard with embedded ID3 tags)
      const targetQueryUrl = directUrl || (targetVideoId ? `https://youtube.com/watch?v=${targetVideoId}` : '');
      if (targetQueryUrl) {
        const packaged = await requestPackagedMp3(targetQueryUrl, finalTitle, finalUploader, finalThumbnail);
        if (packaged && packaged.downloadUrl) {
          finalFileName = packaged.filename || finalFileName;
          try {
            const mp3Res = await axios.get(packaged.downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: 50 * 1024 * 1024,
              timeout: AXIOS_TIMEOUT,
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': API_BASE
              }
            });
            if (mp3Res.data) audioData = mp3Res.data;
          } catch (_) {}
        }
      }

      // 2. Fallback: Stream Proxy
      if (!audioData) {
        const streamRes = await axios.get(proxyUrl, {
          responseType: 'arraybuffer',
          maxContentLength: 50 * 1024 * 1024,
          timeout: AXIOS_TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': API_BASE
          }
        });
        audioData = streamRes.data;
      }

      await sock.sendMessage(chatId, { react: { text: '⬆️', key: message.key } });

      // Send as playable audio
      await sock.sendMessage(chatId, {
        audio: audioData,
        mimetype: 'audio/mpeg',
        fileName: finalFileName,
        contextInfo: {
          externalAdReply: {
            title: finalTitle,
            body: `Now Playing • ${finalDuration}`,
            thumbnailUrl: finalThumbnail,
            sourceUrl: directUrl || (targetVideoId ? `https://youtube.com/watch?v=${targetVideoId}` : API_BASE),
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: message });

      // Send as downloadable MP3 document (respects MP3 file saving)
      await sock.sendMessage(chatId, {
        document: audioData,
        mimetype: 'audio/mpeg',
        fileName: finalFileName,
        contextInfo: {
          externalAdReply: {
            title: finalTitle,
            body: `Audio MP3 • ${finalDuration}`,
            thumbnailUrl: finalThumbnail,
            sourceUrl: directUrl || (targetVideoId ? `https://youtube.com/watch?v=${targetVideoId}` : API_BASE),
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
      console.error('Play command error:', error);
      await sock.sendMessage(chatId, {
        text: `❌ *Download failed!*\n\nReason: ${error.message || 'Service temporarily unavailable'}\n\nPlease try again shortly.`
      }, { quoted: message });
    }
  }
};
