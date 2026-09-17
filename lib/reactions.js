const fs = require('fs');
const path = require('path');
const store = require('./lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// --- Smart Reaction Categories & Suitable Emojis ---
const reactionCategories = [
  {
    category: 'laughter',
    keywords: ['haha', 'hahaha', 'lol', 'lmao', 'lmfao', 'xd', 'rofl', 'funny', 'joke', 'cheka', 'vunja mbavu', '😂', '🤣'],
    emojis: ['😂', '🤣', '💀', '😭']
  },
  {
    category: 'love',
    keywords: ['love', 'i love you', 'nakupenda', 'miss you', 'babe', 'baby', 'darling', 'sweetheart', 'honey', 'kiss', 'muah', 'bae', 'crush', 'cutie', 'sweet'],
    emojis: ['❤️', '💖', '🥰', '😍', '💕', '😘', '💘', '💓']
  },
  {
    category: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'morning', 'good morning', 'good evening', 'good night', 'sup', 'yo', 'sasa', 'mambo', 'habari', 'niaje', 'salut', 'hola', 'gm', 'gn'],
    emojis: ['👋', '✨', '😊', '🫡', '🌟']
  },
  {
    category: 'gratitude',
    keywords: ['thanks', 'thank you', 'asante', 'shukran', 'thx', 'ty', 'appreciate', 'grateful', 'welcome', 'karibu'],
    emojis: ['🙏', '🤝', '💐', '🤍', '✨']
  },
  {
    category: 'celebration_fire',
    keywords: ['fire', 'lit', 'amazing', 'great', 'awesome', 'cool', 'wow', 'congrats', 'congratulations', 'congrat', 'winner', 'win', 'won', 'goat', 'champion', 'top', 'best', 'perfect', 'legend', 'kali', 'moto'],
    emojis: ['🔥', '🎉', '🥳', '🏆', '💯', '⚡', '👏']
  },
  {
    category: 'question_wonder',
    keywords: ['why', 'how', 'what', 'who', 'when', 'where', 'kwanini', 'vipi', 'gani', 'wapi', 'kwani', 'really?', 'seriously?', 'is it?'],
    emojis: ['🤔', '🧐', '👀', '💡']
  },
  {
    category: 'sadness_sympathy',
    keywords: ['sad', 'sorry', 'rip', 'cry', 'crying', 'pain', 'hurt', 'bad', 'sick', 'pole', 'huzuni', 'maumivu', 'rest in peace', 'died', 'death'],
    emojis: ['🥺', '🫂', '💔', '😔', '😢']
  },
  {
    category: 'agreement_ok',
    keywords: ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'fine', 'alright', 'done', 'ndio', 'sawa', 'kabisa', 'sahihi', 'correct', 'agreed'],
    emojis: ['👍', '👌', '✅', '🤝', '🫡']
  },
  {
    category: 'shock_surprise',
    keywords: ['omg', 'damn', 'woah', 'unbelievable', 'no way', 'wtf', 'wth', 'yoh', 'ala'],
    emojis: ['🤯', '😱', '😳', '😮']
  },
  {
    category: 'music_vibe',
    keywords: ['song', 'music', 'audio', 'beat', 'dance', 'vibe', 'sing', 'guitar', 'dj', 'track', 'ngoma', 'mziki'],
    emojis: ['🎶', '🎵', '🎧', '💃', '🕺']
  },
  {
    category: 'faith_prayer',
    keywords: ['amen', 'god', 'bless', 'blessed', 'mungu', 'bariki', 'prayer', 'allah', 'inshallah', 'alhamdulillah'],
    emojis: ['🙏', '🤲', '✨', '🤍']
  }
];

function parseEmojiList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(s => (typeof s === 'string' ? s.trim() : String(s).trim()))
      .filter(s => s && /\p{Extended_Pictographic}/u.test(s));
  }
  let str = String(input).trim();
  if (!str) return [];

  const lower = str.toLowerCase();
  if (lower === 'random' || lower === 'none' || lower === 'false' || lower === 'off' || lower === 'disabled') {
    return [];
  }

  // Strip wrapping quotes if any
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Attempt JSON parsing
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map(s => String(s).trim())
          .filter(s => s && /\p{Extended_Pictographic}/u.test(s));
        if (cleaned.length > 0) return cleaned;
      }
    } catch (_) {
      try {
        const parsed = JSON.parse(str.replace(/'/g, '"'));
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map(s => String(s).trim())
            .filter(s => s && /\p{Extended_Pictographic}/u.test(s));
          if (cleaned.length > 0) return cleaned;
        }
      } catch (_) {}
    }
  }

  // Delimited formats (comma, semicolon, pipe, slash, or whitespace)
  if (/[,;|/\s]+/.test(str)) {
    const parts = str
      .split(/[,;|/\s]+/)
      .map(s => s.trim())
      .filter(s => s && /\p{Extended_Pictographic}/u.test(s));
    if (parts.length > 0) return parts;
  }

  // Contiguous emojis or single emoji without delimiters (using grapheme clusters)
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(str), s => s.segment.trim())
        .filter(s => s && /\p{Extended_Pictographic}/u.test(s));
      if (segments.length > 0) return segments;
    } catch (_) {}
  }

  // Fallback regex extraction
  const matches = str.match(/\p{Extended_Pictographic}/gu);
  if (matches && matches.length > 0) {
    return matches.map(s => s.trim()).filter(Boolean);
  }

  return [];
}

const generalEmojis = [
  '✨', '🔥', '💫', '🌟', '⚡', '👑', '🎯', '💎',
  '🚀', '🍀', '🦋', '🎈', '❤️', '😊', '🫡', '🤝',
  '🌸', '🌹', '🥰', '😍', '🤩', '💐', '🎉', '🥳'
];

function getEffectiveGeneralEmojis() {
  const envEmojis = process.env.AUTO_REACT_EMOJIS || process.env.AUTOREACT_EMOJIS;
  const parsed = parseEmojiList(envEmojis);
  if (parsed.length > 0) return parsed;
  return generalEmojis;
}

function findSuitableEmoji(text) {
  const fallbackList = getEffectiveGeneralEmojis();
  if (!text) {
    return fallbackList[Math.floor(Math.random() * fallbackList.length)];
  }

  const cleanText = text.toLowerCase().trim();
  const words = cleanText.split(/[\s,.;:!?\/\\-]+/).filter(Boolean);

  // Direct Question Mark
  if (cleanText.endsWith('?') || cleanText.includes('?')) {
    const qEmojis = ['🤔', '🧐', '👀', '💡'];
    return qEmojis[Math.floor(Math.random() * qEmojis.length)];
  }

  // Keyword Matching
  for (const cat of reactionCategories) {
    for (const kw of cat.keywords) {
      if (kw.includes(' ')) {
        if (cleanText.includes(kw)) {
          return cat.emojis[Math.floor(Math.random() * cat.emojis.length)];
        }
      } else {
        if (words.includes(kw) || cleanText === kw) {
          return cat.emojis[Math.floor(Math.random() * cat.emojis.length)];
        }
      }
    }
  }

  return fallbackList[Math.floor(Math.random() * fallbackList.length)];
}

// --- AutoReact State Management ---
let memoryAutoReactConfig = null;
const lastReactMap = new Map();

async function getAutoReactConfig() {
  if (memoryAutoReactConfig !== null) {
    return memoryAutoReactConfig;
  }

  // 1. Check Store / Database
  try {
    const saved = await store.getSetting('global', 'autoReact');
    if (saved && typeof saved === 'object') {
      memoryAutoReactConfig = saved;
      return memoryAutoReactConfig;
    }
  } catch {}

  // 2. Check Environment Variables
  const envVal = process.env.AUTO_REACT || process.env.AUTOREACT || process.env.AUTO_REACTION;
  if (envVal !== undefined && envVal !== null && String(envVal).trim() !== '') {
    const str = String(envVal).toLowerCase().trim();
    if (str === 'true' || str === '1' || str === 'on' || str === 'all') {
      memoryAutoReactConfig = { enabled: true, mode: 'all' };
    } else if (str === 'dm' || str === 'inbox' || str === 'pm') {
      memoryAutoReactConfig = { enabled: true, mode: 'dm' };
    } else if (str === 'group' || str === 'groups' || str === 'gc') {
      memoryAutoReactConfig = { enabled: true, mode: 'group' };
    } else {
      memoryAutoReactConfig = { enabled: false, mode: 'all' };
    }
  } else {
    memoryAutoReactConfig = { enabled: false, mode: 'all' };
  }

  return memoryAutoReactConfig;
}

async function setAutoReactConfig(config) {
  memoryAutoReactConfig = {
    enabled: Boolean(config.enabled),
    mode: config.mode || 'all',
    customEmojis: Array.isArray(config.customEmojis) ? config.customEmojis : []
  };

  try {
    await store.saveSetting('global', 'autoReact', memoryAutoReactConfig);
  } catch (e) {
    console.error('Error saving autoReact to store:', e.message);
  }

  process.env.AUTO_REACT = memoryAutoReactConfig.enabled ? memoryAutoReactConfig.mode : 'false';
  return memoryAutoReactConfig;
}

async function handleAutoReact(sock, chatId, message, messageText, isGroup) {
  try {
    if (!message || !message.key || message.key.fromMe) return;
    if (chatId === 'status@broadcast' || chatId.endsWith('@newsletter')) return;

    const config = await getAutoReactConfig();
    if (!config || !config.enabled) return;

    // Filter by mode
    if (config.mode === 'dm' && isGroup) return;
    if (config.mode === 'group' && !isGroup) return;

    // Debounce / rate limit per chat (max 1 reaction per 1.5s per chat)
    const now = Date.now();
    const lastTime = lastReactMap.get(chatId) || 0;
    if (now - lastTime < 1500) return;
    lastReactMap.set(chatId, now);

    // Pick suitable emoji or random custom emoji
    let emoji;
    const envReactEmojis = process.env.AUTO_REACT_EMOJIS || process.env.AUTOREACT_EMOJIS;
    const parsedEnvEmojis = parseEmojiList(envReactEmojis);

    if (parsedEnvEmojis.length > 0) {
      emoji = parsedEnvEmojis[Math.floor(Math.random() * parsedEnvEmojis.length)];
    } else if (config.customEmojis && config.customEmojis.length > 0) {
      emoji = config.customEmojis[Math.floor(Math.random() * config.customEmojis.length)];
    } else {
      emoji = findSuitableEmoji(messageText);
    }

    if (!emoji) return;

    await sock.sendMessage(chatId, {
      react: {
        text: emoji,
        key: message.key
      }
    });

  } catch (err) {
    // Non-fatal
    // console.error('AutoReact error:', err.message);
  }
}

// --- Command Reaction Logic ---
let COMMAND_REACT_ENABLED = false;

async function loadCommandReactState() {
  try {
    if (HAS_DB) {
      const data = await store.getSetting('global', 'userGroupData');
      return data?.autoReaction || false;
    } else {
      if (fs.existsSync(USER_GROUP_DATA)) {
        const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
        return data.autoReaction || false;
      }
    }
  } catch {}
  return false;
}

loadCommandReactState().then(state => {
  COMMAND_REACT_ENABLED = state;
});

async function addCommandReaction(sock, message) {
  if (!COMMAND_REACT_ENABLED) return;
  if (!message?.key?.id) return;

  const envCmdEmoji = (process.env.CMD_REACT_EMOJI || process.env.COMMAND_REACT_EMOJI || '').trim();
  const reactEmoji = envCmdEmoji && /\p{Extended_Pictographic}/u.test(envCmdEmoji) ? envCmdEmoji : '⏳';

  try {
    await sock.sendMessage(message.key.remoteJid, {
      react: { text: reactEmoji, key: message.key }
    });
  } catch {}
}

async function setCommandReactState(state) {
  COMMAND_REACT_ENABLED = state;
  try {
    if (HAS_DB) {
      const data = await store.getSetting('global', 'userGroupData') || {};
      data.autoReaction = state;
      await store.saveSetting('global', 'userGroupData', data);
    } else {
      let data = {};
      if (fs.existsSync(USER_GROUP_DATA)) {
        data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
      }
      data.autoReaction = state;
      fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error saving command react state:', error);
  }
}

module.exports = {
  findSuitableEmoji,
  parseEmojiList,
  getAutoReactConfig,
  setAutoReactConfig,
  handleAutoReact,
  addCommandReaction,
  setCommandReactState,
  loadCommandReactState
};
