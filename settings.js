const settings = {
  prefixes: ['.', '!', '/', '#', '_'],
  packname: process.env.PACKNAME || process.env.PACK_NAME || 'PGWIZ-MD',
  author: process.env.AUTHOR || process.env.PACK_AUTHOR || '‎pgwiz',
  timeZone: process.env.TIMEZONE || 'Asia/Karachi',
  botName: process.env.BOT_NAME || "PGWIZ-MD",
  botOwner: process.env.BOT_OWNER || 'pgwiz',
  ownerNumber: process.env.SUDO_USERS ? process.env.SUDO_USERS.split(',').map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean) : ['254789462334', '62561080893516', '176416033370294'],
  admins: [],
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.MODE || process.env.WORK_TYPE || process.env.WORKTYPE || "public",
  maxStoreMessages: 20,
  tempCleanupInterval: 1 * 60 * 60 * 1000,
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "5.1.3",
  updateZipUrl: process.env.UPDATE_ZIP_URL || "https://github.com/pgwiz/pgwiz-md-litrop/archive/refs/heads/main.zip",
  channelLink: "https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K",
  ytch: "pgwiz",
  newsletterJid: '120363179639202475@newsletter',
  newsletterName: process.env.BOT_NAME || "PGWIZ-MD"
};

module.exports = settings;

