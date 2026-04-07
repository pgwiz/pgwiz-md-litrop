const axios = require('axios');

function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
}

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

module.exports = {
  command: 'ytvid',
  aliases: ['ytvideo', 'ytdl'],
  category: 'download',
  description: 'Download YouTube videos',
  usage: '.ytvid <youtube url> [quality]',
  
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      if (args.length === 0) {
        return await sock.sendMessage(chatId, {
          text: "*YouTube Video Downloader*\n\n*Usage:*\n`.ytvid <url> [quality]`\n\n*Quality Options:*\n• 144 \n• 240 \n• 360 - Default\n• 480 \n• 720 \n• 1080\n\n*Examples:*\n`.ytmp4 https://www.youtube.com/watch?v=example 720`"
        }, { quoted: message });
      }

      const url = args[0];
      const quality = args[1] || '360';

      if (!isValidYouTubeUrl(url)) {
        return await sock.sendMessage(chatId, {
          text: "*Invalid YouTube URL!*\n\nPlease provide a valid YouTube link."
        }, { quoted: message });
      }

      const validQualities = ['144', '240', '360', '480', '720', '1080'];
      if (!validQualities.includes(quality)) {
        return await sock.sendMessage(chatId, {
          text: `❌ *Invalid quality!*\n\nSupported qualities: ${validQualities.join(', ')}\n\nUsing default quality: 360p`
        }, { quoted: message });
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        return await sock.sendMessage(chatId, {
          text: "❌ *Could not extract video ID!*\n\nPlease check the URL and try again."
        }, { quoted: message });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const apiUrl = `https://youtube-main-phi.vercel.app/api/dl/ytmp4?apikey=ruhend&url=${encodeURIComponent(url)}&format=${quality}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data?.result?.result || !response.data.status) {
        return await sock.sendMessage(chatId, {
          text: "❌ *Download failed!*\n\nThe API couldn't process this video."
        }, { quoted: message });
      }

      const videoData = response.data.result.result;
      
      if (!videoData.downloaded || !videoData.download) {
        return await sock.sendMessage(chatId, {
          text: "❌ *Video not available for download!*"
        }, { quoted: message });
      }

      const title = videoData.title;
      const downloadUrl = videoData.download;
      const duration = videoData.duration;
      const actualQuality = videoData.quality;

      await sock.sendMessage(chatId, {
        text: `📥 *Downloading...*\n\n🎬 *${title}*\n⏱️ Duration: ${duration}s\n🎥 Quality: ${actualQuality}p`
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        video: { url: downloadUrl },
        caption: `🎬 *${title}*\n\n⏱️ *Duration:* ${duration}s\n🎥 *Quality:* ${actualQuality}p`,
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`
      }, { quoted: message });

    } catch (error) {
      console.error('YT Download Error:', error);
      let errorMsg = "❌ *Download failed!*\n\n" + (error.message || "Unknown error");
      await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
    }
  }
};

