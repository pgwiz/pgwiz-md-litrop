/**
 * SQLite-based Auth State for Baileys
 * Replaces useMultiFileAuthState with database-backed storage
 * 
 * On first startup, imports creds from session/creds.json (downloaded from session service)
 * All subsequent updates are stored in SQLite
 */

const path = require('path');
const fs = require('fs');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

const SQLITE_URL = process.env.DB_URL || path.join(__dirname, '..', 'baileys_store.db');

let Database = null;
let db = null;
let forceResetApplied = false;

const BUFFER_FIELD_NAMES = new Set(['private', 'public', 'signature', 'privKey', 'pubKey']);

function looksLikeBase64(value) {
    return typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 16;
}

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;

    if (value && typeof value === 'object') {
        if (value.type === 'Buffer' && Array.isArray(value.data)) {
            return Buffer.from(value.data);
        }

        if (value.type === 'Uint8Array' && Array.isArray(value.data)) {
            return Buffer.from(value.data);
        }
    }

    if (Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
        return Buffer.from(value);
    }

    if (looksLikeBase64(value)) {
        try {
            const normalizedInput = value.replace(/\s/g, '');
            const parsed = Buffer.from(normalizedInput, 'base64');
            if (parsed.length > 0) {
                const roundTrip = parsed.toString('base64').replace(/=+$/g, '');
                if (roundTrip === normalizedInput.replace(/=+$/g, '')) {
                    return parsed;
                }
            }
        } catch {
            // Keep original value when decoding fails.
        }
    }

    return value;
}

function normalizeBinaryFields(target, depth = 0) {
    if (!target || typeof target !== 'object' || depth > 8) {
        return { value: target, changed: false };
    }

    if (Buffer.isBuffer(target)) {
        return { value: target, changed: false };
    }

    if (Array.isArray(target)) {
        let changed = false;
        for (let i = 0; i < target.length; i++) {
            const result = normalizeBinaryFields(target[i], depth + 1);
            if (result.changed) {
                target[i] = result.value;
                changed = true;
            }
        }
        return { value: target, changed };
    }

    const directBuffer = toBuffer(target);
    if (Buffer.isBuffer(directBuffer)) {
        return { value: directBuffer, changed: true };
    }

    let changed = false;

    for (const [key, rawValue] of Object.entries(target)) {
        if (rawValue === null || rawValue === undefined) continue;

        if (BUFFER_FIELD_NAMES.has(key)) {
            const converted = toBuffer(rawValue);
            if (converted !== rawValue) {
                target[key] = converted;
                changed = true;
                continue;
            }
        }

        if (typeof rawValue === 'object') {
            const result = normalizeBinaryFields(rawValue, depth + 1);
            if (result.changed) {
                target[key] = result.value;
                changed = true;
            }
        }
    }

    return { value: target, changed };
}

function normalizeCredsForUse(rawCreds) {
    if (!rawCreds || typeof rawCreds !== 'object') {
        return { creds: null, changed: false, valid: false, issues: ['credentials payload is empty or invalid'] };
    }

    const creds = rawCreds;
    const issues = [];
    let changed = false;

    const enforceBufferField = (container, fieldName, expectedLen, label) => {
        if (!container || typeof container !== 'object') {
            issues.push(`${label} missing`);
            return;
        }

        const before = container[fieldName];
        const after = toBuffer(before);

        if (after !== before) {
            container[fieldName] = after;
            changed = true;
        }

        if (!Buffer.isBuffer(container[fieldName])) {
            issues.push(`${label} is not a Buffer`);
            return;
        }

        if (expectedLen && container[fieldName].length !== expectedLen) {
            issues.push(`${label} length=${container[fieldName].length}, expected=${expectedLen}`);
        }
    };

    enforceBufferField(creds.noiseKey, 'private', 32, 'noiseKey.private');
    enforceBufferField(creds.noiseKey, 'public', 32, 'noiseKey.public');
    enforceBufferField(creds.signedIdentityKey, 'private', 32, 'signedIdentityKey.private');
    enforceBufferField(creds.signedIdentityKey, 'public', 32, 'signedIdentityKey.public');

    if (!creds.signedPreKey || typeof creds.signedPreKey !== 'object') {
        issues.push('signedPreKey missing');
    } else {
        enforceBufferField(creds.signedPreKey.keyPair, 'private', 32, 'signedPreKey.keyPair.private');
        enforceBufferField(creds.signedPreKey.keyPair, 'public', 32, 'signedPreKey.keyPair.public');
        enforceBufferField(creds.signedPreKey, 'signature', 64, 'signedPreKey.signature');
    }

    if (creds.advSecretKey && typeof creds.advSecretKey !== 'string') {
        const converted = toBuffer(creds.advSecretKey);
        if (Buffer.isBuffer(converted)) {
            creds.advSecretKey = converted.toString('base64');
            changed = true;
        }
    }

    return {
        creds,
        changed,
        valid: issues.length === 0,
        issues
    };
}

function clearAuthTables(sqlite, reason = '') {
    sqlite.prepare(`DELETE FROM auth_keys`).run();
    sqlite.prepare(`DELETE FROM auth_creds WHERE id = 1`).run();
    const suffix = reason ? ` (${reason})` : '';
    console.warn(`[AUTH] Cleared SQLite auth state${suffix}`);
}

function resetSQLiteAuthState(reason = 'manual-reset') {
    const sqlite = getDb();
    clearAuthTables(sqlite, reason);
}

function getDb() {
    if (db) return db;

    try {
        Database = require('better-sqlite3');
        const dir = path.dirname(SQLITE_URL);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        db = new Database(SQLITE_URL);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Create auth tables
        db.prepare(`
            CREATE TABLE IF NOT EXISTS auth_creds (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL
            )
        `).run();

        db.prepare(`
            CREATE TABLE IF NOT EXISTS auth_keys (
                key_type TEXT NOT NULL,
                key_id TEXT NOT NULL,
                data TEXT NOT NULL,
                PRIMARY KEY (key_type, key_id)
            )
        `).run();

        console.log('[AUTH] SQLite auth state initialized');
        return db;
    } catch (e) {
        console.error('[AUTH] SQLite init error:', e.message);
        throw e;
    }
}

/**
 * Import creds from session/creds.json file into SQLite
 */
function importCredsFromFile() {
    const credsPath = path.join(__dirname, '..', 'session', 'creds.json');

    if (!fs.existsSync(credsPath)) {
        return null;
    }

    try {
        const fileContent = fs.readFileSync(credsPath, 'utf8');
        let creds;

        try {
            creds = JSON.parse(fileContent, BufferJSON.reviver);
        } catch {
            creds = JSON.parse(fileContent);
        }

        const normalized = normalizeCredsForUse(creds);
        if (!normalized.valid) {
            console.error(`[AUTH] Session creds are invalid: ${normalized.issues.join('; ')}`);
            return null;
        }

        // Save to SQLite
        const sqlite = getDb();
        sqlite.prepare(`DELETE FROM auth_keys`).run();

        const credsJson = JSON.stringify(normalized.creds, BufferJSON.replacer);
        sqlite.prepare(`INSERT OR REPLACE INTO auth_creds (id, data) VALUES (1, ?)`).run(credsJson);

        if (normalized.changed) {
            console.log('[AUTH] Imported and normalized creds from session file to SQLite');
        } else {
            console.log('[AUTH] Imported creds from session file to SQLite');
        }

        return normalized.creds;
    } catch (e) {
        console.error('[AUTH] Error importing creds from file:', e.message);
        return null;
    }
}

/**
 * SQLite-based auth state (production-ready replacement for useMultiFileAuthState)
 */
async function useSQLiteAuthState() {
    const sqlite = getDb();
    const shouldForceReset = String(process.env.FORCE_SESSION_RESET || '').toLowerCase() === 'true';

    if (shouldForceReset && !forceResetApplied) {
        clearAuthTables(sqlite, 'FORCE_SESSION_RESET=true');
        forceResetApplied = true;
    }

    // Try to load creds from SQLite first
    let creds = null;
    const credsRow = sqlite.prepare(`SELECT data FROM auth_creds WHERE id = 1`).get();

    if (credsRow) {
        try {
            creds = JSON.parse(credsRow.data, BufferJSON.reviver);

            const normalized = normalizeCredsForUse(creds);
            if (!normalized.valid) {
                console.error(`[AUTH] SQLite creds are invalid: ${normalized.issues.join('; ')}`);
                clearAuthTables(sqlite, 'invalid-credentials');
                creds = null;
            } else {
                creds = normalized.creds;
                if (normalized.changed) {
                    const repairedCredsJson = JSON.stringify(creds, BufferJSON.replacer);
                    sqlite.prepare(`INSERT OR REPLACE INTO auth_creds (id, data) VALUES (1, ?)`).run(repairedCredsJson);
                    console.warn('[AUTH] Normalized credential buffers from SQLite');
                }
            }

            console.log('[AUTH] Loaded creds from SQLite');
        } catch (e) {
            console.error('[AUTH] Error parsing creds from SQLite:', e.message);
        }
    }

    // If no creds in SQLite, try to import from session file
    if (!creds) {
        creds = importCredsFromFile();
    }

    // If still no creds, initialize fresh
    if (!creds) {
        creds = initAuthCreds();
        console.log('[AUTH] Initialized fresh credentials');
    }

    const saveCreds = () => {
        try {
            const credsJson = JSON.stringify(creds, BufferJSON.replacer);
            sqlite.prepare(`INSERT OR REPLACE INTO auth_creds (id, data) VALUES (1, ?)`).run(credsJson);
        } catch (e) {
            console.error('[AUTH] Error saving creds:', e.message);
        }
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    if (!Array.isArray(ids) || ids.length === 0) {
                        return {};
                    }

                    const data = {};
                    const stmt = sqlite.prepare(`SELECT key_id, data FROM auth_keys WHERE key_type = ? AND key_id IN (${ids.map(() => '?').join(',')})`);
                    const rows = stmt.all(type, ...ids);

                    for (const row of rows) {
                        try {
                            let value = JSON.parse(row.data, BufferJSON.reviver);

                            const normalized = normalizeBinaryFields(value);
                            value = normalized.value;

                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[row.key_id] = value;
                        } catch (e) {
                            console.error(`[AUTH] Error parsing key ${type}:${row.key_id}:`, e.message);
                        }
                    }

                    return data;
                },
                set: async (data) => {
                    const insertStmt = sqlite.prepare(`INSERT OR REPLACE INTO auth_keys (key_type, key_id, data) VALUES (?, ?, ?)`);
                    const deleteStmt = sqlite.prepare(`DELETE FROM auth_keys WHERE key_type = ? AND key_id = ?`);

                    const insertMany = sqlite.transaction((items) => {
                        for (const item of items) {
                            if (item.action === 'insert') {
                                insertStmt.run(item.type, item.id, item.data);
                            } else {
                                deleteStmt.run(item.type, item.id);
                            }
                        }
                    });

                    const items = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) {
                                const normalized = normalizeBinaryFields(value);
                                items.push({
                                    action: 'insert',
                                    type: category,
                                    id,
                                    data: JSON.stringify(normalized.value, BufferJSON.replacer)
                                });
                            } else {
                                items.push({
                                    action: 'delete',
                                    type: category,
                                    id
                                });
                            }
                        }
                    }

                    if (items.length > 0) {
                        insertMany(items);
                    }
                }
            }
        },
        saveCreds
    };
}

module.exports = { useSQLiteAuthState, resetSQLiteAuthState };
