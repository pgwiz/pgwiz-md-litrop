const DEFAULT_MESSAGE_TIMEOUT_MS = 800;

function parseIntEnv(name, fallbackValue) {
  const raw = process.env[name];
  if (!raw) return fallbackValue;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallbackValue;
}

class DBRouter {
  constructor(store, options = {}) {
    this.store = store;
    this.normalizeJid = options.normalizeJid || ((jid) => jid);
    this.messageTimeoutMs = parseIntEnv('DB_ROUTER_MESSAGE_TIMEOUT_MS', DEFAULT_MESSAGE_TIMEOUT_MS);
    this.backendLogged = false;
  }

  getBackend() {
    try {
      const stats = this.store.getStats();
      return stats && stats.backend ? stats.backend : 'memory';
    } catch {
      return 'memory';
    }
  }

  isDatabaseBacked() {
    return this.getBackend() !== 'memory';
  }

  logBackendOnce() {
    if (this.backendLogged) return;
    this.backendLogged = true;
    console.log(`[DB-ROUTER] Conversation reads backend: ${this.getBackend()}`);
  }

  async loadConversationMessage(key) {
    if (!key || !key.remoteJid || !key.id) return undefined;

    this.logBackendOnce();

    if (!this.isDatabaseBacked()) {
      return undefined;
    }

    try {
      const jid = this.normalizeJid(key.remoteJid);
      const loadPromise = this.store.loadMessage(jid, key.id);
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), this.messageTimeoutMs);
      });

      const message = await Promise.race([loadPromise, timeoutPromise]);
      return message && message.message ? message.message : undefined;
    } catch {
      return undefined;
    }
  }
}

function createDBRouter(store, options = {}) {
  return new DBRouter(store, options);
}

module.exports = {
  DBRouter,
  createDBRouter,
};
