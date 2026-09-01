const videoPlugin = require('./video');

module.exports = {
  command: 'ytmp4',
  aliases: ['ytvid', 'ytvideo', 'ytdl'],
  category: 'download',
  description: 'Download YouTube videos in high quality',
  usage: '.ytmp4 <youtube url | song name> [360p|720p]',

  async handler(sock, message, args, context = {}) {
    return videoPlugin.handler(sock, message, args, context);
  }
};
