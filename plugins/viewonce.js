const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

module.exports = {
  command: 'viewonce',
  aliases: ['viewmedia', 'vv', 'vvadmin', 'vvowner'],
  category: 'general',
  description: 'Re-send a view-once media in chat or forward to owner privately (.vvadmin)',
  usage: '.viewonce (reply to a view-once media) | .vvadmin (forward to owner)',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const invokedCmd = (context.invokedCmd || context.command || '').toLowerCase();
    const isToOwner = invokedCmd === 'vvadmin' || invokedCmd === 'vvowner' || (args[0] && args[0].toLowerCase() === 'owner');

    try {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      // Check for different types of view-once messages (including V2)
      const quotedImage = quoted?.imageMessage;
      const quotedVideo = quoted?.videoMessage;
      const quotedAudio = quoted?.audioMessage;

      const viewOnceMessage = quoted?.viewOnceMessage || quoted?.viewOnceMessageV2;
      const viewOnceImage = viewOnceMessage?.message?.imageMessage;
      const viewOnceVideo = viewOnceMessage?.message?.videoMessage;
      const viewOnceAudio = viewOnceMessage?.message?.audioMessage;

      let mediaType = '';
      let mediaMessage = null;
      let caption = '';

      if (quotedImage && (quotedImage.viewOnce || quotedImage.fileLength)) {
        mediaType = 'image';
        mediaMessage = quotedImage;
        caption = quotedImage.caption || '';
      } else if (quotedVideo && (quotedVideo.viewOnce || quotedVideo.fileLength)) {
        mediaType = 'video';
        mediaMessage = quotedVideo;
        caption = quotedVideo.caption || '';
      } else if (quotedAudio && (quotedAudio.viewOnce || quotedAudio.fileLength)) {
        mediaType = 'audio';
        mediaMessage = quotedAudio;
      } else if (viewOnceImage) {
        mediaType = 'image';
        mediaMessage = viewOnceImage;
        caption = viewOnceImage.caption || '';
      } else if (viewOnceVideo) {
        mediaType = 'video';
        mediaMessage = viewOnceVideo;
        caption = viewOnceVideo.caption || '';
      } else if (viewOnceAudio) {
        mediaType = 'audio';
        mediaMessage = viewOnceAudio;
      }

      if (!mediaType || !mediaMessage) {
        await sock.sendMessage(chatId, {
          text: '❌ Please reply to a valid view-once image, video, or voice note.'
        }, { quoted: message });
        return;
      }

      // If forwarding to owner, get owner JID
      let targetDestination = chatId;
      if (isToOwner) {
        const ownerNumber = settings.ownerNumber && settings.ownerNumber[0]
          ? (settings.ownerNumber[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net')
          : null;

        if (!ownerNumber) {
          await sock.sendMessage(chatId, {
            text: '❌ Main admin / owner number is not configured in settings.'
          }, { quoted: message });
          return;
        }
        targetDestination = ownerNumber;
      }

      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      let messageContent = {};
      const prefixCaption = isToOwner ? `Forwarded ViewOnce ${mediaType.toUpperCase()}\n\n` : '';

      if (mediaType === 'image') {
        messageContent = { image: buffer, caption: prefixCaption + (caption || '') };
      } else if (mediaType === 'video') {
        messageContent = { video: buffer, caption: prefixCaption + (caption || '') };
      } else if (mediaType === 'audio') {
        messageContent = { audio: buffer, mimetype: 'audio/mpeg', ptt: true };
      }

      await sock.sendMessage(targetDestination, messageContent);

      if (isToOwner) {
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
      }

    } catch (error) {
      console.error('Error in viewonceCommand:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to retrieve the view-once media. Please try again later.'
      }, { quoted: message });
    }
  }
};
