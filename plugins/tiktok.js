const axios = require('axios');

const AXIOS_TIMEOUT = 60000;

function isValidTikTokUrl(url) {
  if (!url) return false;
  return /(?:tiktok\.com\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/|t\.tiktok\.com\/)/i.test(url);
}

function cleanTikTokUrl(text) {
  const match = text.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?tiktok\.com\/[^\s]+/i);
  return match ? match[0] : null;
}

async function fetchTikTokData(url) {
  let lastError;

  // 1. Primary: TikWM GET API
  try {
    const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.data && res.data.data) {
      const d = res.data.data;
      let videoUrl = d.hdplay || d.play || d.wmplay;
      if (videoUrl && !videoUrl.startsWith('http')) {
        videoUrl = 'https://www.tikwm.com' + videoUrl;
      }
      let musicUrl = d.music;
      if (musicUrl && !musicUrl.startsWith('http')) {
        musicUrl = 'https://www.tikwm.com' + musicUrl;
      }

      return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
        username: d.author?.unique_id || '',
        avatar: d.author?.avatar,
        duration: d.duration ? `${d.duration}s` : 'N/A',
        likes: d.digg_count || d.stats?.likes || 0,
        comments: d.comment_count || d.stats?.comment || 0,
        shares: d.share_count || d.stats?.share || 0,
        views: d.play_count || d.stats?.views || 0,
        sound: d.music_info?.title || d.music || 'Original Sound',
        videoUrl: videoUrl,
        musicUrl: musicUrl,
        images: Array.isArray(d.images) ? d.images : null,
        isHD: Boolean(d.hdplay)
      };
    }
  } catch (e1) {
    lastError = e1;
  }

  // 2. Secondary: TikWM POST API
  try {
    const res = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
      url: url,
      count: 12,
      cursor: 0,
      web: 1,
      hd: 1
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 20000
    });

    if (res.data && res.data.data) {
      const d = res.data.data;
      let videoUrl = d.hdplay || d.play || d.wmplay;
      if (videoUrl && !videoUrl.startsWith('http')) {
        videoUrl = 'https://www.tikwm.com' + videoUrl;
      }

      return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
        username: d.author?.unique_id || '',
        duration: d.duration ? `${d.duration}s` : 'N/A',
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0,
        views: d.play_count || 0,
        sound: d.music_info?.title || 'Original Sound',
        videoUrl: videoUrl,
        musicUrl: d.music ? (d.music.startsWith('http') ? d.music : 'https://www.tikwm.com' + d.music) : null,
        images: Array.isArray(d.images) ? d.images : null,
        isHD: Boolean(d.hdplay)
      };
    }
  } catch (e2) {
    lastError = e2;
  }

  // 3. Fallback: Tiklydown API
  try {
    const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
      timeout: 20000
    });
    if (res.data) {
      const d = res.data;
      const video = d.video?.noWatermark || d.video?.watermark;
      if (video) {
        return {
          title: d.title || 'TikTok Video',
          author: d.author?.name || 'TikTok User',
          username: d.author?.unique_id || '',
          duration: 'N/A',
          likes: d.stats?.likeCount || 0,
          comments: d.stats?.commentCount || 0,
          shares: d.stats?.shareCount || 0,
          views: d.stats?.playCount || 0,
          sound: d.music?.title || 'Original Sound',
          videoUrl: video,
          musicUrl: d.music?.play_url,
          images: Array.isArray(d.images) ? d.images.map(img => img.url) : null,
          isHD: true
        };
      }
    }
  } catch (e3) {
    lastError = e3;
  }

  throw new Error(`Failed to extract TikTok media: ${lastError?.message || 'Server error'}`);
}

module.exports = {
  command: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl', 'tiktoknowm'],
  category: 'download',
  description: 'Download TikTok video (HD No Watermark), photo slides, or audio',
  usage: '.tiktok <TikTok URL> [mp3/audio]',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const rawInput = args.join(' ').trim();
    const url = cleanTikTokUrl(rawInput);

    if (!url || !isValidTikTokUrl(url)) {
      return await sock.sendMessage(chatId, {
        text: '🎵 *TikTok Downloader (HD No Watermark)*\n\n' +
          '*Usage:*\n' +
          '• `.tiktok <TikTok link>` - Download Video or Photo Slide\n' +
          '• `.tiktok <TikTok link> audio` - Extract Audio only\n\n' +
          '*Example:*\n' +
          '`.tiktok https://vm.tiktok.com/ZMxxxxxx/`'
      }, { quoted: message });
    }

    const wantAudioOnly = rawInput.toLowerCase().includes('mp3') || rawInput.toLowerCase().includes('audio') || rawInput.toLowerCase().includes('sound');

    try {
      await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

      const data = await fetchTikTokData(url);

      // 1. Audio-only mode
      if (wantAudioOnly && data.musicUrl) {
        await sock.sendMessage(chatId, {
          text: `🎧 *${data.title}*\n⏳ Downloading audio track...`
        }, { quoted: message });

        const audioRes = await axios.get(data.musicUrl, {
          responseType: 'arraybuffer',
          timeout: AXIOS_TIMEOUT,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        await sock.sendMessage(chatId, {
          audio: audioRes.data,
          mimetype: 'audio/mpeg',
          fileName: `${data.title}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: data.title,
              body: `Sound: ${data.sound} • By ${data.author}`,
              thumbnailUrl: data.avatar,
              sourceUrl: url,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return;
      }

      // 2. Photo Slideshow mode
      if (data.images && data.images.length > 0) {
        await sock.sendMessage(chatId, {
          text: `📸 *TikTok Photo Slide Detected*\nSending ${data.images.length} photos...`
        }, { quoted: message });

        for (let i = 0; i < data.images.length; i++) {
          const imgUrl = typeof data.images[i] === 'string' ? data.images[i] : data.images[i].url;
          if (imgUrl) {
            await sock.sendMessage(chatId, {
              image: { url: imgUrl },
              caption: i === 0 ? `📝 *${data.title}*\n👤 *Author:* ${data.author}` : undefined
            });
            await new Promise(r => setTimeout(r, 600));
          }
        }

        // Also send background music
        if (data.musicUrl) {
          await sock.sendMessage(chatId, {
            audio: { url: data.musicUrl },
            mimetype: 'audio/mpeg',
            fileName: 'sound.mp3'
          });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return;
      }

      // 3. HD Video mode
      if (!data.videoUrl) {
        throw new Error('No downloadable video stream found');
      }

      const caption =
`🎵 *TikTok Downloader*
━━━━━━━━━━━━━━━━━━━
👤 *Author:* ${data.author} (@${data.username})
⏱️ *Duration:* ${data.duration}
❤️ *Likes:* ${Number(data.likes).toLocaleString()}
💬 *Comments:* ${Number(data.comments).toLocaleString()}
🔁 *Shares:* ${Number(data.shares).toLocaleString()}
👀 *Views:* ${Number(data.views).toLocaleString()}

🎧 *Sound:* ${data.sound}

📝 *Caption:*
${data.title || 'No caption'}

✨ *Quality:* ${data.isHD ? 'HD No Watermark' : 'No Watermark'}
━━━━━━━━━━━━━━━━━━━
> *Downloaded via MEGA-MD*`;

      const videoRes = await axios.get(data.videoUrl, {
        responseType: 'arraybuffer',
        timeout: AXIOS_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      await sock.sendMessage(chatId, {
        video: videoRes.data,
        mimetype: 'video/mp4',
        fileName: `${data.author}_tiktok.mp4`,
        caption: caption
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
      console.error('TikTok downloader error:', error);
      await sock.sendMessage(chatId, {
        text: `❌ *Failed to download TikTok video!*\n\nReason: ${error.message || 'Service unavailable'}\n\nPlease verify the link and try again.`
      }, { quoted: message });
    }
  }
};
