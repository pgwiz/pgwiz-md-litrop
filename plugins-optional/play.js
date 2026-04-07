const axios = require('axios');

module.exports = {
  command: 'play',
  aliases: ['plays', 'music'],
  category: 'music',
  description: 'Search and download a song as MP3 from Spotify',
  usage: '.play <song name>',
  
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const searchQuery = args.join(' ').trim();

    try {
      if (!searchQuery) {
        return await sock.sendMessage(chatId, {
          text: "*Which song do you want to play?*\nUsage: .play <song name>"
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, {
        text: "🔍 *Searching for your song...*"
      }, { quoted: message });

      await new Promise(resolve => setTimeout(resolve, 10000));

      const searchUrl = `https://discardapi.dpdns.org/api/search/spotify?apikey=guru&query=${encodeURIComponent(searchQuery)}`;
      const searchResponse = await axios.get(searchUrl, { timeout: 30000 });
      
      if (!searchResponse.data?.result?.result || searchResponse.data.result.result.length === 0) {
        return await sock.sendMessage(chatId, {
          text: "❌ *No songs found!*\nTry a different search term."
        }, { quoted: message });
      }

      const topResult = searchResponse.data.result.result[0];
      const songName = topResult.name;
      const artistName = topResult.artists;
      const spotifyLink = topResult.link;

      await new Promise(resolve => setTimeout(resolve, 10000));

      const downloadUrl = `https://discardapi.dpdns.org/api/dl/spotify?apikey=guru&url=${encodeURIComponent(spotifyLink)}`;
      const downloadResponse = await axios.get(downloadUrl, { timeout: 60000 });

      if (!downloadResponse.data?.result?.result?.download_url) {
        return await sock.sendMessage(chatId, {
          text: "❌ *Download failed!*\nThe API couldn't fetch the audio. Try again later."
        }, { quoted: message });
      }

      const songData = downloadResponse.data.result.result;
      const audioUrl = songData.download_url;
      const title = songData.title;
      const albumImage = songData.albumImage;
      const duration = songData.duration;
      const year = songData.year;

      await sock.sendMessage(chatId, {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${title} - ${artistName}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: title,
            body: `${artistName} • ${duration} • ${year}`,
            thumbnail: albumImage ? await axios.get(albumImage, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data)) : null,
            mediaType: 2,
            mediaUrl: spotifyLink,
            sourceUrl: spotifyLink
          }
        }
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        text: `✅ *Download Complete!*\n\n🎵 *Title:* ${title}\n👤 *Artist:* ${artistName}\n⏱️ *Duration:* ${duration}\n📅 *Year:* ${year}`
      }, { quoted: message });

    } catch (error) {
      console.error('Play Command Error:', error);
      
      let errorMsg = "❌ *Download failed!*\n\n";
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMsg += "*Reason:* Connection timeout\nThe API took too long to respond.";
      } else if (error.response) {
        errorMsg += `*Status:* ${error.response.status}\n*Error:* ${error.response.statusText}`;
      } else {
        errorMsg += `*Error:* ${error.message}`;
      }
      
      errorMsg += "\n\nPlease try again later.";

      await sock.sendMessage(chatId, {
        text: errorMsg
      }, { quoted: message });
    }
  }
};
