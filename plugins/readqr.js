// Lazy-loaded: const axios = require('axios');
// Lazy-loaded: const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  command: 'readqr',
  aliases: ['qrread', 'decodeqr'],
  category: 'tools',
  description: 'Read QR code from an image',
  usage: 'Reply to an image with .readqr',

  async handler(sock, message, args, context = {}) {
    const FormData = require('form-data');
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const quoted =
        message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted?.imageMessage) {
        return await sock.sendMessage(
          chatId,
          { text: '🧾 *QR Reader*\n\n📌 Reply to an image that contains a QR code\n\nUsage:\n.readqr' },
          { quoted: message }
        );
      }

      await sock.sendMessage(chatId, {
        react: { text: '🔍', key: message.key }
      });

      const stream = await downloadContentFromMessage(
        quoted.imageMessage,
        'image'
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const tempFile = path.join(__dirname, `qr_${Date.now()}.png`);
      fs.writeFileSync(tempFile, buffer);

      const form = new FormData();
      form.append('file', fs.createReadStream(tempFile));

      const res = await axios.post(
        'http://api.qrserver.com/v1/read-qr/',
        form,
        { headers: form.getHeaders(), timeout: 20000 }
      );

      try { fs.unlinkSync(tempFile); } catch (_) {}

      const decodedText = res?.data?.[0]?.symbol?.[0]?.data;
      const errorText = res?.data?.[0]?.symbol?.[0]?.error;

      if (!decodedText || errorText) {
        throw new Error(errorText || 'No QR code could be read from this image');
      }

      await sock.sendMessage(
        chatId,
        {
          text: `✅ *QR Code Decoded Successfully*\n\n📄 *Content:*\n\`\`\`\n${decodedText}\n\`\`\`\n\n> Powered by MEGA-MD`
        },
        { quoted: message }
      );

    } catch (err) {
      console.error('QR Reader Error:', err);
      await sock.sendMessage(
        chatId,
        { text: `❌ Failed to read QR code: ${err.message || 'Please try a clearer image'}` },
        { quoted: message }
      );
    }
  }
};
