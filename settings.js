const settings = {
  alwaysOnline: (() => {
    const v = process.env.ALWAYS_ONLINE || process.env.ALWAYS_ONLINE_PRESENCE;
    if (v === undefined || v === null || String(v).trim() === '') return false;
    return String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'on';
  })(),
  prefixes: ['.', '!', '/', '#', '_'],
  packname: process.env.PACKNAME || process.env.PACK_NAME || process.env.BOT_NAME || "PGWIZ-MD",
  author: process.env.AUTHOR || process.env.PACK_AUTHOR || '‎pgwiz',
  timeZone: process.env.TIMEZONE || 'Asia/Karachi',
  botName: process.env.BOT_NAME || process.env.BOTNAME || "PGWIZ-MD",
  botOwner: process.env.BOT_OWNER || 'pgwiz',
  ownerNumber: (() => {
    const envOwners = process.env.OWNER_NUMBER || process.env.OWNER_NUMBERS || process.env.NUM_OWNER || process.env.OWNER || process.env.SUDO_USERS || '';
    const parsed = envOwners ? envOwners.split(',').map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean) : [];
    const defaults = ['254789462334', '62561080893516', '176416033370294'];
    return Array.from(new Set([...parsed, ...defaults])).filter(Boolean);
  })(),
  admins: [],
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.MODE || process.env.WORK_TYPE || process.env.WORKTYPE || "public",
  maxStoreMessages: 20,
  tempCleanupInterval: 1 * 60 * 60 * 1000,
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "5.2.0",
  updateZipUrl: process.env.UPDATE_ZIP_URL || "https://github.com/pgwiz/pgwiz-md-litrop/archive/refs/heads/main.zip",
  channelLink: "https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K",
  ytch: "pgwiz",
  newsletterJid: '120363179639202475@newsletter',
  newsletterName: process.env.BOT_NAME || process.env.BOTNAME || process.env.NEWSLETTER_NAME || "PGWIZ-MD"
};

module.exports = settings;

