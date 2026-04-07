const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OPTIONAL_DIR = path.join(__dirname, '..', 'plugins-optional');
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

function extractCategory(source) {
  const match = source.match(/category\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (!match) return 'misc';
  return match[1].toLowerCase();
}

function buildPackIndex() {
  if (!fs.existsSync(OPTIONAL_DIR)) return null;
  const files = fs.readdirSync(OPTIONAL_DIR).filter(file => file.endsWith('.js'));
  const packs = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(OPTIONAL_DIR, file), 'utf8');
      const category = extractCategory(content);
      if (!packs[category]) packs[category] = [];
      packs[category].push(file);
    } catch (e) {
      if (!packs.misc) packs.misc = [];
      packs.misc.push(file);
    }
  }

  return { files, packs };
}

async function installPack(packName) {
  const index = buildPackIndex();
  if (!index) return { error: 'Optional plugin folder not found.' };

  const normalized = packName.toLowerCase();
  const files = normalized === 'all' ? index.files : index.packs[normalized];

  if (!files || files.length === 0) {
    return { error: `Unknown pack "${packName}".`, packs: Object.keys(index.packs) };
  }

  let installed = 0;
  let skipped = 0;

  for (const file of files) {
    const src = path.join(OPTIONAL_DIR, file);
    const dest = path.join(PLUGINS_DIR, file);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    await fs.promises.copyFile(src, dest);
    installed++;
  }

  return { installed, skipped, total: files.length, packs: Object.keys(index.packs) };
}

module.exports = {
  command: 'addplugin',
  aliases: ['installplugin', 'install'],
  category: 'owner',
  description: 'Install a plugin from a GitHub Gist URL (owner only)',
  usage: '.addplugin <Gist URL> | .addplugin pack:<category|all>',

  /**
   * @param {object} sock - Baileys sock
   * @param {object} message - the original message object
   * @param {Array} args - command arguments
   * @param {object} context - additional context
   */
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    const text = args?.[0];
    if (!text) {
      return await sock.sendMessage(chatId, { 
        text: 'Please provide a plugin URL or pack.\nExamples:\n• .addplugin https://gist.github.com/username/gistid\n• .addplugin pack:group\n• .addplugin pack:all' 
      }, { quoted: message });
    }

    const first = text.toLowerCase();
    const second = args?.[1]?.toLowerCase();
    const isPack =
      first === 'pack' ||
      first === 'packs' ||
      first.startsWith('pack:') ||
      first.startsWith('category:');

    if (isPack) {
      const packName = first === 'pack' || first === 'packs'
        ? (second || '')
        : first.split(':').slice(1).join(':').trim();

      if (!packName) {
        const index = buildPackIndex();
        const available = index ? Object.keys(index.packs).sort().join(', ') : 'none';
        return await sock.sendMessage(chatId, {
          text: `Available packs: ${available}\n\nUse: .addplugin pack:<category|all>`
        }, { quoted: message });
      }

      const result = await installPack(packName);
      if (result.error) {
        return await sock.sendMessage(chatId, {
          text: `${result.error}\n\nAvailable packs: ${result.packs?.sort().join(', ') || 'none'}`
        }, { quoted: message });
      }

      return await sock.sendMessage(chatId, {
        text: `✅ Installed pack "${packName}".\n• Installed: ${result.installed}\n• Skipped: ${result.skipped}\n• Total: ${result.total}`
      }, { quoted: message });
    }

    const gistMatch = text.match(/(?:\/|gist\.github\.com\/)([a-fA-F0-9]+)/);
    if (!gistMatch) {
      return await sock.sendMessage(chatId, { text: '❌ Invalid plugin URL.' }, { quoted: message });
    }

    const gistId = gistMatch[1];
    const gistURL = `https://api.github.com/gists/${gistId}`;

    try {
      const response = await axios.get(gistURL);
      const gistData = response.data;

      if (!gistData || !gistData.files) {
        return await sock.sendMessage(chatId, { text: '❌ No valid files found in the Gist.' }, { quoted: message });
      }

      for (const file of Object.values(gistData.files)) {
        const pluginName = file.filename;
        const pluginPath = path.join(PLUGINS_DIR, pluginName);

        await fs.promises.writeFile(pluginPath, file.content);
      }

      await sock.sendMessage(chatId, { text: '*✅ Successfully installed plugin from Gist.*' }, { quoted: message });
    } catch (error) {
      console.error('install plugin error:', error);
      await sock.sendMessage(chatId, { text: `❌ Error fetching or saving the plugin: ${error.message}` }, { quoted: message });
    }
  }
};

