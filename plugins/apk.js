// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'apk',
  aliases: ['app', 'getapk', 'downloadapk', 'apkdl'],
  category: 'download',
  description: 'Download Android APK application',
  usage: '.apk <app name>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return await sock.sendMessage(chatId, {
        text: '📱 *APK Downloader*\n\n📌 Please provide an app name to search and download.\n\n*Usage:* `.apk Telegram`\n*Aliases:* `.app`, `.getapk`, `.apkdl`'
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
      react: { text: '🔍', key: message.key }
    });

    try {
      const searchUrl = `http://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=1`;
      const res = await axios.get(searchUrl, { timeout: 15000 });

      const appData = res.data?.datalist?.list?.[0];
      if (!appData || !appData.file?.path) {
        return await sock.sendMessage(chatId, {
          text: `❌ *No APK found for:* "${query}". Please check the spelling.`
        }, { quoted: message });
      }

      const name = appData.name || query;
      const pkg = appData.package || '';
      const version = appData.file?.vername || 'Latest';
      const sizeBytes = appData.file?.filesize || appData.size || 0;
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      const downloadUrl = appData.file?.path;
      const iconUrl = appData.icon;

      const caption =
        `📱 *APK DOWNLOADER*\n\n` +
        `📦 *App:* ${name}\n` +
        `🆔 *Package:* ${pkg}\n` +
        `🔢 *Version:* ${version}\n` +
        `⚖️ *Size:* ${sizeMB} MB\n\n` +
        `> Powered by MEGA-MD`;

      // WhatsApp document file size limit safe threshold ~80MB
      if (sizeBytes > 80 * 1024 * 1024) {
        return await sock.sendMessage(chatId, {
          image: { url: iconUrl },
          caption: `${caption}\n\n⚠️ *File exceeds WhatsApp upload limit (80MB).*\n🔗 *Direct Download Link:*\n${downloadUrl}`
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⬇️', key: message.key }
      });

      const apkResponse = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: 85 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Android; Mobile)'
        }
      });

      const apkBuffer = Buffer.from(apkResponse.data);

      await sock.sendMessage(chatId, {
        document: apkBuffer,
        fileName: `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_v${version}.apk`,
        mimetype: 'application/vnd.android.package-archive',
        caption: caption
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: message.key }
      });

    } catch (err) {
      console.error('APK Downloader Error:', err?.message || err);
      await sock.sendMessage(chatId, {
        text: `❌ *APK Download Failed:* ${err?.message || 'Download error'}`
      }, { quoted: message });
    }
  }
};
