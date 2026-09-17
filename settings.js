// Zero-dependency environment loader with safe dotenv fallback (compatible with all panels & environments)
(function loadEnvironment() {
    try {
        require('dotenv').config();
    } catch {
        // Safe fallback: parse .env using native fs without external dependencies
        try {
            const fs = require('fs');
            const path = require('path');
            const candidates = [
                path.join(__dirname, '.env'),
                path.join(process.cwd(), '.env'),
                path.join(__dirname, '..', '.env'),
                path.join(process.cwd(), '..', '.env'),
                path.join(process.cwd(), 'pgwiz-md-litrop', '.env'),
                path.join(process.cwd(), 'MEGA-MD', '.env')
            ];
            for (const envFile of candidates) {
                if (fs.existsSync(envFile)) {
                    const raw = fs.readFileSync(envFile, 'utf8');
                    for (let line of raw.split(/\r?\n/)) {
                        line = line.trim();
                        if (!line || line.startsWith('#')) continue;
                        const eq = line.indexOf('=');
                        if (eq > 0) {
                            const key = line.substring(0, eq).trim();
                            let val = line.substring(eq + 1).trim();
                            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.slice(1, -1);
                            }
                            if (process.env[key] === undefined) {
                                process.env[key] = val;
                            }
                        }
                    }
                    break;
                }
            }
        } catch {}
    }
})();
const settings = {
  alwaysOnline: (() => {
    const v = process.env.ALWAYS_ONLINE || process.env.ALWAYS_ONLINE_PRESENCE;
    if (v === undefined || v === null || String(v).trim() === '') return false;
    return String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'on';
  })(),
  prefixes: ['.', '!', '/', '#', '_'],
  packname: process.env.PACKNAME || process.env.PACK_NAME || process.env.BOT_NAME || "PGWIZ-MD",
  author: process.env.AUTHOR || process.env.PACK_AUTHOR || '‎pgwiz',
  timeZone: process.env.TZ || process.env.TIMEZONE || 'Africa/Nairobi',
  botName: process.env.BOT_NAME || process.env.BOTNAME || "PGWIZ-MD",
  botOwner: process.env.BOT_OWNER || 'pgwiz',
  ownerNumber: (() => {
    const envOwners = process.env.OWNER_NUMBER || process.env.OWNER_NUMBERS || process.env.NUM_OWNER || process.env.OWNER || process.env.SUDO_USERS || '';
    const parsed = envOwners ? envOwners.split(',').map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean) : [];
    const defaults = ['254789462334', '62561080893516', '176416033370294'];
    return Array.from(new Set([...parsed, ...defaults])).filter(Boolean);
  })(),
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.MODE || process.env.WORK_TYPE || process.env.WORKTYPE || "public",
  maxStoreMessages: 20,
  tempCleanupInterval: 1 * 60 * 60 * 1000,
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "5.2.0",
  updateZipUrl: process.env.UPDATE_ZIP_URL || "https://github.com/WiPTechGx/MEGA-MD/archive/refs/heads/main.zip",
  channelLink: "https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K",
  ytch: "pgwiz",
  newsletterJid: '120363179639202475@newsletter',
  newsletterName: process.env.BOT_NAME || process.env.BOTNAME || process.env.NEWSLETTER_NAME || "PGWIZ-MD",
  statusEmojis: (process.env.AUTO_STATUS_EMOJIS && process.env.AUTO_STATUS_EMOJIS.trim()) || (process.env.STATUS_EMOJIS && process.env.STATUS_EMOJIS.trim()) || "❤️,🔥,✨,💯,🌟,⚡,😍,👏,💖,🥰,👍,🎉",
  statusReaction: (process.env.AUTO_STATUS_REACTION && process.env.AUTO_STATUS_REACTION.trim()) || (process.env.STATUS_REACTION && process.env.STATUS_REACTION.trim()) || (process.env.AUTO_STATUS_EMOJI && process.env.AUTO_STATUS_EMOJI.trim()) || (process.env.STATUS_EMOJI && process.env.STATUS_EMOJI.trim()) || "",
  autoReactEmojis: (process.env.AUTO_REACT_EMOJIS && process.env.AUTO_REACT_EMOJIS.trim()) || (process.env.AUTOREACT_EMOJIS && process.env.AUTOREACT_EMOJIS.trim()) || (process.env.AUTO_REACT_EMOJI && process.env.AUTO_REACT_EMOJI.trim()) || (process.env.AUTOREACT_EMOJI && process.env.AUTOREACT_EMOJI.trim()) || "",
  cmdReactEmoji: (process.env.CMD_REACT_EMOJI && process.env.CMD_REACT_EMOJI.trim()) || (process.env.COMMAND_REACT_EMOJI && process.env.COMMAND_REACT_EMOJI.trim()) || "⏳"
};

if (!process.env.TZ) {
  process.env.TZ = settings.timeZone;
}

module.exports = settings;

