const store = require('../lib/lightweight_store');

const autoEmojis = [
  '💘','💝','💖','💗','💓','💞','💕','💟','❣️','❤️',
  '🧡','💛','💚','💙','💜','🤎','🖤','🤍','♥️',
  '🎈','🎁','💌','💐','😘','🤗',
  '🌸','🌹','🥀','🌺','🌼','🌷',
  '🍁','⭐️','🌟','😊','🥰','😍',
  '🤩','☺️'
];

let AUTO_REACT_MESSAGES = false;
let lastReactedTime = 0;

function parseEnvBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

async function getDefaultAutoreactEnabled() {
  const rawValue = await store.getEnvBackedSetting('AUTOREACT', 'false');
  return parseEnvBoolean(rawValue, false);
}

async function loadAutoreactState() {
  const fallback = await getDefaultAutoreactEnabled();
  const config = await store.getSetting('global', 'autoreact');
  if (!config || typeof config.enabled !== 'boolean') {
    const initial = { enabled: fallback };
    await store.saveSetting('global', 'autoreact', initial);
    return initial;
  }
  return { enabled: !!config.enabled };
}

async function saveAutoreactState(enabled) {
  await store.saveSetting('global', 'autoreact', { enabled: !!enabled });
}

function initAutoReact(sock) {
  if (sock.__autoReactAttached) return;

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const state = await loadAutoreactState();
    if (!state.enabled) return;

    for (const m of messages) {
      if (!m?.message) continue;
      if (m.key.fromMe) continue;

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        '';

      if (!text) continue;
      if (/^[!#.$%^&*+=?<>]/.test(text)) continue;

      const now = Date.now();
      if (now - lastReactedTime < 2000) continue;

      await sock.sendMessage(m.key.remoteJid, {
        react: {
          text: random(autoEmojis),
          key: m.key
        }
      });

      lastReactedTime = now;
    }
  });

  sock.__autoReactAttached = true;
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  command: 'autoreact',
  aliases: ['areact'],
  category: 'owner',
  description: 'Toggle auto-react to messages',
  usage: '.autoreact on/off',
  ownerOnly: true,
  
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const current = await loadAutoreactState();
    AUTO_REACT_MESSAGES = current.enabled;
    
    if (!args[0] || !['on', 'off'].includes(args[0])) {
      await sock.sendMessage(chatId, {
        text: '*Usage:*\n.autoreact on/off',
        ...channelInfo
      }, { quoted: message });
      return;
    }

    AUTO_REACT_MESSAGES = args[0] === 'on';
    await saveAutoreactState(AUTO_REACT_MESSAGES);

    await sock.sendMessage(chatId, {
      text: AUTO_REACT_MESSAGES ? '*✅ Auto-react enabled*' : '*❌ Auto-react disabled*',
      ...channelInfo
    }, { quoted: message });

    initAutoReact(sock);
  },

  initAutoReact
};
