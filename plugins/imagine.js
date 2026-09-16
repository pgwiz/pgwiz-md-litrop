// Lazy-loaded: const axios = require('axios');

module.exports = {
  command: 'imagine',
  aliases: ['aiimage', 'draw', 'genimage', 'dalle', 'flux'],
  category: 'ai',
  description: 'Generate a high-resolution AI image using Pollinations/Flux',
  usage: '.imagine <prompt>',

  async handler(sock, message, args, context = {}) {
    const axios = require('axios');
    const chatId = context.chatId || message.key.remoteJid;
    const imagePrompt = args.join(' ').trim();

    if (!imagePrompt) {
      return await sock.sendMessage(chatId, {
        text: '🎨 *AI Image Generator*\n\n📌 Please provide a prompt describing the image.\n\n*Usage:* `.imagine a cyberpunk city at night with neon lights, 4k`\n*Aliases:* `.draw`, `.genimage`, `.flux`'
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
      react: { text: '🎨', key: message.key }
    });

    try {
      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(imagePrompt);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;

      let imageBuffer = null;

      try {
        const response = await axios.get(pollinationsUrl, {
          responseType: 'arraybuffer',
          timeout: 40000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        if (response.status === 200 && response.data?.length > 1000) {
          imageBuffer = Buffer.from(response.data);
        }
      } catch (pollError) {
        console.warn('Pollinations primary failed, attempting fallback...', pollError?.message);
      }

      // Secondary fallback if primary buffer failed
      if (!imageBuffer) {
        try {
          const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=800&height=800&seed=${seed}`;
          const response = await axios.get(fallbackUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
          });
          if (response.status === 200 && response.data?.length > 1000) {
            imageBuffer = Buffer.from(response.data);
          }
        } catch (fErr) {
          console.error('Fallback image provider error:', fErr?.message);
        }
      }

      if (!imageBuffer) {
        throw new Error('All image generation services are currently busy. Please try again in a few moments.');
      }

      await sock.sendMessage(chatId, {
        image: imageBuffer,
        caption: `✨ *Prompt:* ${imagePrompt}\n🎨 *Model:* Flux / Pollinations AI\n> Powered by MEGA-MD`
      }, { quoted: message });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: message.key }
      });

    } catch (error) {
      console.error('Error in imagine command:', error?.message || error);
      await sock.sendMessage(chatId, {
        text: `❌ *Image Generation Error:* ${error?.message || 'Could not generate image'}`
      }, { quoted: message });
    }
  }
};
