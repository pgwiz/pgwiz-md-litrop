'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const settings = require('../settings');
const { channelInfo } = require('../lib/messageConfig');

const AXIOS_TIMEOUT = 45000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isValidTikTokUrl(url) {
  if (!url) return false;
  return /(?:tiktok\.com\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/|t\.tiktok\.com\/)/i.test(url);
}

function cleanTikTokUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?tiktok\.com\/[^\s]+/i);
  return match ? match[0] : null;
}

async function resolveCanonicalUrl(url) {
  try {
    if (/vm\.tiktok\.com|vt\.tiktok\.com|\/t\//i.test(url)) {
      const res = await axios.get(url, {
        maxRedirects: 5,
        timeout: 10000,
        headers: { 'User-Agent': USER_AGENT }
      });
      const finalUrl = res.request?.res?.responseUrl || res.config?.url || url;
      return finalUrl.split('?')[0];
    }
  } catch (e) {
    if (e.response?.headers?.location) {
      return e.response.headers.location.split('?')[0];
    }
  }
  return url;
}

async function fetchFromTikWM(url) {
  try {
    const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
      timeout: 15000,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (res.data?.code === 0 && res.data.data) {
      const d = res.data.data;
      let videoUrl = d.play || d.wmplay || d.hdplay;
      if (videoUrl && !videoUrl.startsWith('http')) videoUrl = 'https://www.tikwm.com' + videoUrl;
      let musicUrl = d.music;
      if (musicUrl && !musicUrl.startsWith('http')) musicUrl = 'https://www.tikwm.com' + musicUrl;

      return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
        username: d.author?.unique_id || '',
        avatar: d.author?.avatar,
        duration: d.duration ? `${d.duration}s` : 'N/A',
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0,
        views: d.play_count || 0,
        sound: d.music_info?.title || d.music || 'Original Sound',
        videoUrl,
        musicUrl,
        images: Array.isArray(d.images) && d.images.length > 0 ? d.images : null,
        provider: 'TikWM'
      };
    }
  } catch (_) {}
  return null;
}

async function fetchFromSSSTik(url) {
  try {
    const postData = new URLSearchParams({ id: url, locale: 'en', tt: 0 });
    const res = await axios.post('https://ssstik.io/abc?url=dl', postData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
        'HX-Request': 'true',
        'HX-Trigger': '_gcaptcha_pt',
        'HX-Target': 'target',
        'HX-Current-URL': 'https://ssstik.io/en',
        'Referer': 'https://ssstik.io/en'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const videoLinks = [];
    let musicUrl = null;
    let author = $('.pure-u-18-24 h2').text().trim() || 'TikTok Creator';
    let title = $('.maintext').text().trim() || 'TikTok Video';

    $('a.download_link').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        if (href.includes('tikcdn.io/ssstik/m/') || href.includes('music') || href.includes('mp3')) {
          musicUrl = href;
        } else {
          videoLinks.push(href);
        }
      }
    });

    const images = [];
    $('.splide__slide img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-splide-lazy');
      if (src && src.startsWith('http')) images.push(src);
    });

    if (videoLinks.length > 0 || images.length > 0) {
      return {
        title,
        author,
        username: author.replace(/[^a-zA-Z0-9._]/g, ''),
        avatar: null,
        duration: 'N/A',
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        sound: 'Original Sound',
        videoUrl: videoLinks[0] || null,
        musicUrl,
        images: images.length > 0 ? images : null,
        provider: 'SSSTik'
      };
    }
  } catch (_) {}
  return null;
}

async function fetchFromTikWMPost(url) {
  try {
    const postData = new URLSearchParams({ url, count: 12, cursor: 0, web: 1, hd: 1 });
    const res = await axios.post('https://www.tikwm.com/api/', postData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.tikwm.com/'
      },
      timeout: 15000
    });

    if (res.data?.code === 0 && res.data.data) {
      const d = res.data.data;
      let videoUrl = d.play || d.wmplay || d.hdplay;
      if (videoUrl && !videoUrl.startsWith('http')) videoUrl = 'https://www.tikwm.com' + videoUrl;
      let musicUrl = d.music;
      if (musicUrl && !musicUrl.startsWith('http')) musicUrl = 'https://www.tikwm.com' + musicUrl;

      return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
        username: d.author?.unique_id || '',
        avatar: d.author?.avatar,
        duration: d.duration ? `${d.duration}s` : 'N/A',
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0,
        views: d.play_count || 0,
        sound: d.music_info?.title || d.music || 'Original Sound',
        videoUrl,
        musicUrl,
        images: Array.isArray(d.images) && d.images.length > 0 ? d.images : null,
        provider: 'TikWM-POST'
      };
    }
  } catch (_) {}
  return null;
}

async function fetchTikTokData(rawUrl) {
  const url = await resolveCanonicalUrl(rawUrl);

  // Try Engine 1: TikWM GET
  let data = await fetchFromTikWM(url);
  if (data) return data;

  // If initial input was redirected or different, try raw URL with TikWM
  if (url !== rawUrl) {
    data = await fetchFromTikWM(rawUrl);
    if (data) return data;
  }

  // Try Engine 2: SSSTik Scraper
  data = await fetchFromSSSTik(url);
  if (data) return data;

  if (url !== rawUrl) {
    data = await fetchFromSSSTik(rawUrl);
    if (data) return data;
  }

  // Try Engine 3: TikWM POST
  data = await fetchFromTikWMPost(url);
  if (data) return data;

  throw new Error('All TikTok download providers are currently unreachable or the video is private/deleted.');
}

module.exports = {
  command: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl', 'tiktoknowm'],
  category: 'download',
  description: 'Download TikTok video (Direct Streaming & Lowest Quality Data Saver), photo slides, or audio',
  usage: '.tiktok <TikTok URL> [mp3/audio]',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    let rawInput = args.join(' ').trim();

    if (!rawInput) {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text;
      if (quotedText) {
        const match = quotedText.match(/https?:\/\/[^\s]+/);
        if (match) rawInput = match[0];
      }
    }

    const url = cleanTikTokUrl(rawInput);

    if (!url || !isValidTikTokUrl(url)) {
      return await sock.sendMessage(chatId, {
        text: '🎵 *TikTok Downloader*\n\n' +
          '*Usage:*\n' +
          '• `.tiktok <TikTok link>` - Download Video or Photo Slide\n' +
          '• `.tiktok <TikTok link> audio` - Extract Audio only\n\n' +
          '*Example:*\n' +
          '`.tiktok https://vm.tiktok.com/ZMxxxxxx/`',
        ...channelInfo
      }, { quoted: message });
    }

    const wantAudioOnly = rawInput.toLowerCase().includes('mp3') || rawInput.toLowerCase().includes('audio') || rawInput.toLowerCase().includes('sound');

    try {
      await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

      const data = await fetchTikTokData(url);

      // 1. Audio-only mode
      if (wantAudioOnly && data.musicUrl) {
        await sock.sendMessage(chatId, {
          text: `🎧 *${data.title}*\n⏳ Downloading audio track...`,
          ...channelInfo
        }, { quoted: message });

        const audioRes = await axios.get(data.musicUrl, {
          responseType: 'arraybuffer',
          timeout: AXIOS_TIMEOUT,
          headers: { 'User-Agent': USER_AGENT }
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
          text: `📸 *TikTok Photo Slide Detected*\nSending ${data.images.length} photos...`,
          ...channelInfo
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

        // Send background audio if available
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

      // 3. Video mode: Direct URL streaming with buffer fallback
      if (!data.videoUrl) {
        throw new Error('No downloadable video stream found for this TikTok.');
      }

      const caption =
`🎵 *TikTok Downloader*
━━━━━━━━━━━━━━━━━━━
👤 *Author:* ${data.author} ${data.username ? '(@' + data.username + ')' : ''}
⏱️ *Duration:* ${data.duration}
❤️ *Likes:* ${Number(data.likes).toLocaleString()}
💬 *Comments:* ${Number(data.comments).toLocaleString()}
🔁 *Shares:* ${Number(data.shares).toLocaleString()}
👀 *Views:* ${Number(data.views).toLocaleString()}

🎧 *Sound:* ${data.sound}

📝 *Caption:*
${data.title || 'No caption'}

✨ *Source:* ${data.provider}
━━━━━━━━━━━━━━━━━━━
> *Downloaded via ${settings.botName || 'PGWIZ-MD'}*`;

      let sent = false;
      // Step A: Attempt Direct URL Stream (fastest, zero container RAM usage)
      try {
        await sock.sendMessage(chatId, {
          video: { url: data.videoUrl },
          mimetype: 'video/mp4',
          fileName: `${data.author}_tiktok.mp4`,
          caption: caption,
          ...channelInfo
        }, { quoted: message });
        sent = true;
      } catch (streamErr) {
        console.warn('[TIKTOK] Direct URL stream delivery failed, falling back to buffer download:', streamErr.message);
      }

      // Step B: Buffer fallback if direct URL stream fails
      if (!sent) {
        const videoRes = await axios.get(data.videoUrl, {
          responseType: 'arraybuffer',
          timeout: AXIOS_TIMEOUT,
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://www.tiktok.com/'
          }
        });

        await sock.sendMessage(chatId, {
          video: videoRes.data,
          mimetype: 'video/mp4',
          fileName: `${data.author}_tiktok.mp4`,
          caption: caption,
          ...channelInfo
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
      console.error('TikTok downloader error:', error);
      await sock.sendMessage(chatId, {
        text: `❌ *Failed to download TikTok video!*\n\nReason: ${error.message || 'Service unavailable'}\n\nPlease verify the link and try again.`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
