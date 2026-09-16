const os = require('os');
const path = require('path');
const fs = require('fs');

module.exports = {
  command: 'tts',
  aliases: ['texttospeech', 'say', 'speak'],
  category: 'tools',
  description: 'Convert text to speech and send as voice audio',
  usage: '.tts <text> [lang] or reply to a message with .tts',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    // Support replying to a message
    let text = args.join(' ').trim();
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || 
                       quoted?.extendedTextMessage?.text || 
                       quoted?.imageMessage?.caption || 
                       quoted?.videoMessage?.caption;

    let lang = 'en';

    if (!text && quotedText) {
      text = quotedText;
    } else if (text && args.length > 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(args[args.length - 1])) {
      lang = args.pop().toLowerCase();
      text = args.join(' ').trim();
    } else if (!text && !quotedText) {
      return await sock.sendMessage(chatId, {
        text: '🗣️ *Text to Speech (TTS)*\n\n📌 Please provide text or reply to a message.\n\n*Usage:*\n• `.tts Hello, how are you?`\n• `.tts Bonjour fr`\n• Reply to a message with `.tts`'
      }, { quoted: message });
    }

    // Limit text length for TTS
    if (text.length > 500) {
      text = text.substring(0, 500);
    }

    await sock.sendMessage(chatId, {
      react: { text: '🗣️', key: message.key }
    });

    try {
      // Primary: Google TTS API
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;

      const response = await axios.get(googleTtsUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 200 && response.data?.length > 100) {
        return await sock.sendMessage(chatId, {
          audio: Buffer.from(response.data),
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: message });
      }
      throw new Error('Google TTS returned invalid buffer');

    } catch (ttsErr) {
      // Fallback: gtts library if installed
      try {
        const gTTS = require('gtts');
        const tempPath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
        const gtts = new gTTS(text, lang);

        await new Promise((resolve, reject) => {
          gtts.save(tempPath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        const audioBuffer = fs.readFileSync(tempPath);
        try { fs.unlinkSync(tempPath); } catch (_) {}

        await sock.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: message });

      } catch (fbErr) {
        console.error('TTS Error:', ttsErr?.message, fbErr?.message);
        await sock.sendMessage(chatId, {
          text: `❌ *TTS Error:* Unable to convert text to speech: ${ttsErr?.message || 'Service unavailable'}`
        }, { quoted: message });
      }
    }
  }
};
