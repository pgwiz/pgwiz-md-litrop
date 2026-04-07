const axios = require('axios');

module.exports = {
  command: 'joke2',
  aliases: ['funny2', 'jokes2'],
  category: 'fun',
  description: 'Get a random general joke',
  usage: '.joke2',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const res = await axios.get('https://discardapi.dpdns.org/api/joke/general?apikey=guru');

      if (!res.data || res.data.status !== true) {
        return await sock.sendMessage(chatId, { text: '❌ Failed to fetch joke.' }, { quoted: message });
      }

      const setup = res.data.result?.setup || 'No setup found';
      const punchline = res.data.result?.punchline || 'No punchline found';
      const creator = res.data.creator || 'Unknown';

      const replyText = `😂 *Joke*\n\n${setup}\n\n👉 ${punchline}`;

      await sock.sendMessage(chatId, { text: replyText }, { quoted: message });

    } catch (err) {
      console.error('Joke plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Error while fetching joke.' }, { quoted: message });
    }
  }
};
