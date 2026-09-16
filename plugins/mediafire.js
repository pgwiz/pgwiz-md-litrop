// Lazy-loaded dependencies inside handler
async function mediafireDl(url, axios, cheerio) {
  try {
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    const link = $('#downloadButton').attr('href');
    const name = $('div.dl-info > div.promo-text').text().trim() || $('.dl-btn-label').attr('title') || 'file';
    const size = $('#downloadButton').text().replace(/Download|[\(\)]|\s/g, '').trim() || 'Unknown';
    const ext = name.split('.').pop() || 'bin';
    
    return { name, size, link, ext };
  } catch (e) {
    return null;
  }
}

module.exports = {
  command: 'mediafire',
  aliases: ['mfire', 'mf'],
  category: 'download',
  description: 'Download files from MediaFire',
  usage: '.mediafire <url>',

  async handler(sock, message, args, context = {}) {
    const cheerio = require('cheerio');
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    let text = args.join(' ').trim();

    if (!text) {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text;
      if (quotedText) {
        const match = quotedText.match(/https?:\/\/[^\s]+/);
        if (match) text = match[0];
      }
    }

    if (!text || !text.includes('mediafire.com')) {
      return await sock.sendMessage(chatId, {
        text: '📁 *MediaFire Downloader*\n\n📌 Please provide a valid MediaFire link.\n\n*Usage:*\n`.mediafire https://www.mediafire.com/file/...`\n*Aliases:* `.mfire`, `.mf`'
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
      react: { text: '⏳', key: message.key }
    });

    try {
      const data = await mediafireDl(text, axios, cheerio);
      if (!data || !data.link) {
        return await sock.sendMessage(chatId, {
          text: '❌ Failed to parse MediaFire page. The file may have been removed or is private.'
        }, { quoted: message });
      }

      // Check size safeguard (e.g. over 80MB)
      if (data.size && (data.size.includes('GB') || (data.size.includes('MB') && parseFloat(data.size) > 80))) {
        return await sock.sendMessage(chatId, {
          text: `⚠️ *File Too Large for WhatsApp:* ${data.name} (${data.size})\n\nDirect Download Link:\n${data.link}`
        }, { quoted: message });
      }

      await sock.sendMessage(chatId, {
        text: `📁 *MEDIAFIRE DOWNLOADER*\n\n📄 *File:* ${data.name}\n⚖️ *Size:* ${data.size}\n⏳ *Downloading... Please wait.*`
      }, { quoted: message });

      const response = await axios({
        method: 'get',
        url: data.link,
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 80 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': text
        }
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length < 500) {
        throw new Error('Downloaded file payload is empty or invalid.');
      }

      let mimeType = 'application/octet-stream';
      const mimes = { 
        'zip': 'application/zip', 
        'pdf': 'application/pdf', 
        'apk': 'application/vnd.android.package-archive', 
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip'
      };
      if (mimes[data.ext.toLowerCase()]) mimeType = mimes[data.ext.toLowerCase()];

      await sock.sendMessage(chatId, {
        document: buffer,
        fileName: data.name,
        mimetype: mimeType,
        caption: `✅ *MediaFire Download Complete*\n📄 *File:* ${data.name}\n⚖️ *Size:* ${data.size}\n\n> Powered by MEGA-MD`
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: message.key }
      });

    } catch (err) {
      console.error('MF Download Error:', err);
      await sock.sendMessage(chatId, {
        text: `❌ *MediaFire Error:* ${err.message || 'Download failed'}`
      }, { quoted: message });
    }
  }
};
