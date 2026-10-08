const fs = require('fs');
const path = require('path');
const store = require('./lightweight_store');

class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.categories = new Map();
    this.stats = new Map();
    this.cooldowns = new Map();
    this.disabledCommands = new Set();
    this.prefixlessCommands = new Map();
    this.watchPlugins();
  }

  watchPlugins() {
    const pluginsPath = path.join(__dirname, '../plugins');
    if (!fs.existsSync(pluginsPath)) return;

    try {
      const watcher = fs.watch(pluginsPath, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
          const filePath = path.join(pluginsPath, filename);
          try {
            if (fs.existsSync(filePath)) {
              delete require.cache[require.resolve(filePath)];
              const plugin = require(filePath);
              if (plugin && plugin.command) {
                this.registerCommand(plugin);
                // console.log(`[WATCHER] Hot-reloaded: ${filename}`); // Suppressed to reduce log spam
              }
            }
          } catch (error) {
            console.error(`[WATCHER] Error reloading ${filename}:`, error.message);
          }
        }
      });
      if (watcher && typeof watcher.unref === 'function') {
        watcher.unref();
      }
    } catch (err) {
      // Ignored if file watching is unavailable
    }
  }

  loadCommands() {
    const pluginsPath = path.join(__dirname, '../plugins');
    const optionalPath = path.join(__dirname, '../plugins-optional');
    
    if (!fs.existsSync(pluginsPath)) return;

    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const filePath = path.join(pluginsPath, file);
        
        // SAFETY CHECK: Prevent loading from plugins-optional directory
        if (filePath.includes('plugins-optional')) {
          console.warn(`[BLOCKED] Attempted to load plugin from plugins-optional: ${file}`);
          continue;
        }

        delete require.cache[require.resolve(filePath)];
        const plugin = require(filePath);

        if (plugin && plugin.command) {
          this.registerCommand(plugin);
        }
      } catch (error) {
        console.error(`Error loading ${file}:`, error.message);
      }
    }
  }

  registerCommand(plugin) {
    const { command, aliases = [], category = 'misc', handler } = plugin;

    // INTEGRITY CHECK
    if (!command || typeof handler !== 'function') {
      console.error(`[SKIP] Plugin at ${command || 'unknown'} is missing a valid command name or handler function.`);
      return;
    }

    const cmdKey = command.toLowerCase();

    // DUPLICATE CHECK
    if (this.commands.has(cmdKey)) {
      // console.warn(`[REPLACED] Command "${cmdKey}" was already registered and has been overwritten.`); // Suppressed to reduce log spam
    }

    this.stats.set(cmdKey, {
      calls: 0,
      errors: 0,
      totalTime: 0n,
      avgMs: 0
    });

    const monitoredHandler = async (sock, message, ...args) => {
      const s = this.stats.get(cmdKey);

      if (this.disabledCommands.has(cmdKey)) {
        return await sock.sendMessage(message.key.remoteJid, {
          text: `🚫 The command *${cmdKey}* is currently disabled.`
        }, { quoted: message });
      }

      const userId = message.key.participant || message.key.remoteJid;
      const now = Date.now();
      const cooldownKey = `${userId}_${cmdKey}`;

      if (this.cooldowns.has(cooldownKey)) {
        const expirationTime = this.cooldowns.get(cooldownKey) + (plugin.cooldown || 3000);
        if (now < expirationTime) return;
      }

      this.cooldowns.set(cooldownKey, now);
      const start = process.hrtime.bigint();

      try {
        s.calls++;
        return await handler(sock, message, ...args);
      } catch (err) {
        s.errors++;
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        s.totalTime += (end - start);
        s.avgMs = Number(s.totalTime / BigInt(s.calls || 1)) / 1_000_000;
      }
    };

    this.commands.set(cmdKey, {
      ...plugin,
      command,
      handler: monitoredHandler,
      category: category.toLowerCase(),
      aliases
    });

    if (plugin.isPrefixless === true) {
      this.prefixlessCommands.set(cmdKey, cmdKey);
      if (plugin.aliases && Array.isArray(plugin.aliases)) {
        plugin.aliases.forEach(alias => {
          if (typeof alias === 'string' && alias.length > 0) {
            this.prefixlessCommands.set(alias.toLowerCase(), cmdKey);
          }
        });
      }
    }

    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.length > 0) {
        this.aliases.set(alias.toLowerCase(), cmdKey);
      }
    }

    const catKey = (typeof category === 'string' ? category : 'misc').toLowerCase();
    if (!this.categories.has(catKey)) {
      this.categories.set(catKey, []);
    }

    if (!this.categories.get(catKey).includes(command)) {
      this.categories.get(catKey).push(command);
    }
  }

  toggleCommand(name) {
    if (!name || typeof name !== 'string') return 'disabled';
    const cmd = name.trim().toLowerCase();
    if (!cmd) return 'disabled';
    if (this.disabledCommands.has(cmd)) {
      this.disabledCommands.delete(cmd);
      Promise.resolve(store.setDisabledPlugin(cmd, false)).catch(() => { });
      return 'enabled';
    } else {
      this.disabledCommands.add(cmd);
      Promise.resolve(store.setDisabledPlugin(cmd, true, 'manual-toggle')).catch(() => { });
      return 'disabled';
    }
  }

  async hydrateDisabledCommands() {
    try {
      const disabledPlugins = await store.getDisabledPlugins();
      this.disabledCommands = new Set(
        (disabledPlugins || []).map(name => String(name).toLowerCase()).filter(Boolean)
      );
    } catch (error) {
      console.error('[COMMAND_HANDLER] Failed to hydrate disabled plugins:', error.message);
    }
  }

  _levenshtein(a, b) {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) tmp[i] = [i];
    for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  }

  findSuggestion(cmd) {
    if (!cmd || typeof cmd !== 'string') return null;
    const cleanCmd = cmd.trim().toLowerCase();
    if (!cleanCmd) return null;
    const allNames = [...this.commands.keys(), ...this.aliases.keys()];
    let bestMatch = null;
    let minDistance = 3;

    for (const name of allNames) {
      const distance = this._levenshtein(cleanCmd, name);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = name;
      }
    }
    return bestMatch;
  }

  getDiagnostics() {
    return Array.from(this.stats.entries()).map(([name, data]) => ({
      command: name,
      usage: data.calls,
      errors: data.errors,
      average_speed: `${data.avgMs.toFixed(3)}ms`,
      status: this.disabledCommands.has(name) ? 'OFF' : 'ON'
    })).sort((a, b) => b.usage - a.usage);
  }

  resetStats() {
    this.stats.clear();
    this.cooldowns.clear();
    for (const cmd of this.commands.keys()) {
      this.stats.set(cmd, { calls: 0, errors: 0, totalTime: 0n, avgMs: 0 });
    }
  }

  reloadCommands() {
    this.commands.clear();
    this.aliases.clear();
    this.categories.clear();
    this.stats.clear();
    this.cooldowns.clear();
    this.disabledCommands.clear();
    this.prefixlessCommands.clear();
    this.loadCommands();
  }

  getCommand(text, prefixes) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    let activePrefixes;
    if (Array.isArray(prefixes)) {
      activePrefixes = prefixes;
    } else if (typeof prefixes === 'string' && prefixes.trim().length > 0) {
      activePrefixes = [prefixes.trim()];
    } else if (prefixes instanceof Set) {
      activePrefixes = Array.from(prefixes);
    } else {
      activePrefixes = ['.', '!', '/', '#', '_'];
    }

    activePrefixes = Array.from(new Set(
      activePrefixes.filter(p => typeof p === 'string' && p.length > 0)
    )).sort((a, b) => b.length - a.length);

    if (activePrefixes.length === 0) {
      activePrefixes = ['.', '!', '/', '#', '_'];
    }

    const usedPrefix = activePrefixes.find(p => trimmed.startsWith(p));
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();

    if (!usedPrefix) {
      if (this.prefixlessCommands.has(firstWord)) {
        const targetCmd = this.prefixlessCommands.get(firstWord);
        return this.commands.get(targetCmd) || null;
      }
      return null;
    }

    const commandPart = trimmed.slice(usedPrefix.length).trim();
    if (!commandPart) return null;

    const fullCommand = commandPart.split(/\s+/)[0].toLowerCase();
    if (!fullCommand) return null;

    if (this.commands.has(fullCommand)) {
      return this.commands.get(fullCommand);
    }
    if (this.aliases.has(fullCommand)) {
      const mainCommand = this.aliases.get(fullCommand);
      return this.commands.get(mainCommand) || null;
    }

    // Unknown command - return null without spamming suggestions
    return null;
  }

  getCommandsByCategory(category) {
    if (!category || typeof category !== 'string') return [];
    return this.categories.get(category.trim().toLowerCase()) || [];
  }
}

module.exports = new CommandHandler();

