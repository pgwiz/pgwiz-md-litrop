const store = require('../lib/lightweight_store');
const fs = require('fs');
const settings = require('../settings');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const ANTICALL_PATH = './data/anticall.json';
const DIVIDER = '━━━━━━━━━━━━━';

function parseEnvBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

async function getDefaultAnticallEnabled() {
  const rawValue = await store.getEnvBackedSetting('ANTICALL', 'false');
  return parseEnvBoolean(rawValue, false);
}

async function readState() {
  try {
    const defaultEnabled = await getDefaultAnticallEnabled();

    if (HAS_DB) {
      const dbSettings = await store.getSetting('global', 'anticall');
      if (!dbSettings || typeof dbSettings.enabled !== 'boolean') {
        const initial = { enabled: defaultEnabled };
        await store.saveSetting('global', 'anticall', initial);
        return initial;
      }
      return { enabled: !!dbSettings.enabled };
    } else {
      if (!fs.existsSync(ANTICALL_PATH)) {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: defaultEnabled }, null, 2));
        return { enabled: defaultEnabled };
      }
      const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
      const data = JSON.parse(raw || '{}');
      if (typeof data.enabled !== 'boolean') {
        data.enabled = defaultEnabled;
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: data.enabled }, null, 2));
      }
      return { enabled: !!data.enabled };
    }
  } catch {
    return { enabled: false };
  }
}

async function writeState(enabled) {
  try {
    if (HAS_DB) {
      await store.saveSetting('global', 'anticall', { enabled: !!enabled });
    } else {
      if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
      fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    }
  } catch (e) {
    console.error('Error writing anticall state:', e);
  }
}

module.exports = {
  command: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Enable or disable auto-blocking of incoming calls',
  usage: '.anticall <on|off|status>',
  ownerOnly: true,
  
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const state = await readState();
    const sub = args.join(' ').trim().toLowerCase();
    const botName = (settings.botName || 'PGWIZ-MD').toUpperCase();

    if (!sub || !['on', 'off', 'status'].includes(sub)) {
      return await sock.sendMessage(
        chatId,
        {
          text: `*✩ ${botName} ANTICALL ✩*\n${DIVIDER}\n` +
                `📵 *Auto-block Incoming Calls*\n` +
                `${state.enabled ? '🟢' : '🔴'} *Status:* ${state.enabled ? 'ENABLED' : 'DISABLED'}\n` +
                `💾 *Storage:* ${HAS_DB ? 'Database' : 'Local File'}\n` +
                `${DIVIDER}\n` +
                `*Usage:*\n` +
                `• \`.anticall on\` - Enable\n` +
                `• \`.anticall off\` - Disable\n` +
                `• \`.anticall status\` - Check status\n` +
                `${DIVIDER}`,
          ...channelInfo
        },
        { quoted: message }
      );
    }
    if (sub === 'status') {
      return await sock.sendMessage(
        chatId,
        { 
          text: `*✩ ${botName} ANTICALL STATUS ✩*\n${DIVIDER}\n` +
                `${state.enabled ? '🟢' : '🔴'} *Status:* ${state.enabled ? 'ENABLED' : 'DISABLED'}\n` +
                `💾 *Storage:* ${HAS_DB ? 'Database' : 'Local File'}\n` +
                `ℹ️ *Policy:* ${state.enabled ? 'Auto-reject all calls' : 'Calls permitted'}\n` +
                `${DIVIDER}`,
          ...channelInfo
        },
        { quoted: message }
      );
    }

    const enable = sub === 'on';
    await writeState(enable);

    await sock.sendMessage(
      chatId,
      { 
        text: `*✩ ${botName} ANTICALL ✩*\n${DIVIDER}\n` +
              `${enable ? '🟢' : '🔴'} *Status:* ${enable ? 'ENABLED' : 'DISABLED'}\n` +
              `ℹ️ *Result:* ${enable ? 'Calls will now be rejected automatically.' : 'Incoming calls are now allowed.'}\n` +
              `${DIVIDER}`,
        ...channelInfo
      },
      { quoted: message }
    );
  },
  
  readState,
  writeState
};
