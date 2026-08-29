const fs = require('fs');
const path = require('path');
const https = require('https');
const store = require('../lib/lightweight_store');

// Path to .env file
const envPath = path.join(__dirname, '../.env');

// Helper to read .env
function readEnv() {
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (key && !key.startsWith('#')) {
                env[key] = value;
            }
        }
    });
    return env;
}

// Helper to write to .env
function writeEnv(env) {
    let content = '';
    for (const [key, value] of Object.entries(env)) {
        let data = String(value);
        if (!data.startsWith('"') && (data.includes(' ') || data.includes('=') || data.includes('#') || data.includes(','))) {
            data = '"' + data + '"';
        }
        content += key + '=' + data + '\n';
    }
    fs.writeFileSync(envPath, content.trim() + '\n');
}

// Helper for Heroku API calls
async function herokuApiRequest(method, endpoint, apiKey, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.heroku.com',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.message || parsed.error || ('HTTP ' + res.statusCode)));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error('HTTP ' + res.statusCode + ': ' + data));
                    }
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Helper to get active Heroku credentials
async function getHerokuCredentials() {
    let apiKey = process.env.HKEY || process.env.HEROKU_KEY || process.env.HEROKU_API_KEY || process.env.HEROKU_API_TOKEN || process.env.HEROKU_TOKEN || process.env.HK_KEY;
    let appName = process.env.HAPP || process.env.HEROKU_APP_NAME || process.env.HEROKU_APP || process.env.HEROKU_NAME || process.env.APP_NAME || process.env.HK_APP;

    if (!apiKey || !appName) {
        const storedAuth = await store.getSetting('global', 'herokuAuth');
        if (storedAuth) {
            apiKey = apiKey || storedAuth.apiKey;
            appName = appName || storedAuth.appName;
        }
    }

    if (apiKey && appName && store && typeof store.saveSetting === 'function') {
        store.saveSetting('global', 'herokuAuth', { apiKey, appName }).catch(() => {});
    }

    return { apiKey, appName };
}

module.exports = {
    command: 'pgvars',
    aliases: ['setenv', 'getenv', 'pgvar', 'herokuvar', 'var'],
    category: 'admin',
    description: 'Manage environment variables lively (.env and Heroku)',
    usage: '.pgvars [heroku] <list|update|delete|auth> [KEY=VALUE]',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        if (!args || args.length === 0) {
            let helpText = '🛠️ *PGVars - Dynamic Environment Manager*\n\n';
            helpText += '*📁 Local .env Commands:*\n';
            helpText += '• `.pgvars list` - List all local variables\n';
            helpText += '• `.pgvars set KEY=VALUE` - Update variable live\n';
            helpText += '• `.pgvars delete KEY` - Delete variable\n\n';
            helpText += '*☁️ Heroku Platform Commands:*\n';
            helpText += '• `.pgvars heroku auth <API_KEY> <APP_NAME>` - Save Heroku credentials\n';
            helpText += '• `.pgvars heroku list` - List Heroku config vars\n';
            helpText += '• `.pgvars heroku set KEY=VALUE` - Update Heroku variable\n';
            helpText += '• `.pgvars heroku delete KEY` - Delete Heroku variable\n\n';
            helpText += '_💡 Live changes take effect instantly in-memory without reboot._';
            await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
            return;
        }

        const isHerokuTarget = args[0].toLowerCase() === 'heroku';
        const subCmdIndex = isHerokuTarget ? 1 : 0;
        const subCmd = (args[subCmdIndex] || 'list').toLowerCase();
        const remainingArgs = args.slice(subCmdIndex + 1);

        try {
            // ==========================================
            // HEROKU COMMAND HANDLING
            // ==========================================
            if (isHerokuTarget) {
                if (subCmd === 'auth') {
                    const apiKey = remainingArgs[0];
                    const appName = remainingArgs[1];
                    if (!apiKey || !appName) {
                        await sock.sendMessage(chatId, {
                            text: '❌ *Usage:* `.pgvars heroku auth <API_KEY> <APP_NAME>`'
                        }, { quoted: message });
                        return;
                    }

                    // Save to in-memory process.env and store
                    process.env.HEROKU_API_KEY = apiKey;
                    process.env.HEROKU_APP_NAME = appName;
                    await store.saveSetting('global', 'herokuAuth', { apiKey, appName });

                    // Also save to .env
                    const env = readEnv();
                    env.HEROKU_API_KEY = apiKey;
                    env.HEROKU_APP_NAME = appName;
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Heroku Authenticated!*\n\n📱 *App:* `' + appName + '`\n🔑 *API Key:* `' + apiKey.slice(0, 6) + '...***`\n\nYou can now use `.pgvars heroku list` and `.pgvars heroku set KEY=VALUE`.'
                    }, { quoted: message });
                    return;
                }

                const { apiKey, appName } = await getHerokuCredentials();
                if (!apiKey || !appName) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Heroku credentials not found!*\n\nPlease authenticate first using:\n`.pgvars heroku auth <HEROKU_API_KEY> <HEROKU_APP_NAME>`'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'list') {
                    await sock.sendMessage(chatId, { text: '🔄 Fetching Heroku config vars...' }, { quoted: message });
                    const configVars = await herokuApiRequest('GET', '/apps/' + appName + '/config-vars', apiKey);

                    let text = '☁️ *Heroku Config Vars (' + appName + ')*\n\n';
                    const keys = Object.keys(configVars);
                    if (keys.length === 0) {
                        text += '_No config vars found._';
                    } else {
                        for (const key of keys.sort()) {
                            text += '🔹 *' + key + '*: `' + configVars[key] + '`\n';
                        }
                    }
                    text += '\n_Total: ' + keys.length + ' variables_';
                    await sock.sendMessage(chatId, { text }, { quoted: message });
                    return;
                }

                if (subCmd === 'update' || subCmd === 'set' || subCmd === 'add') {
                    const input = remainingArgs.join(' ');
                    if (!input.includes('=')) {
                        await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars heroku set KEY=VALUE`' }, { quoted: message });
                        return;
                    }

                    const key = input.split('=')[0].trim();
                    const value = input.split('=').slice(1).join('=').trim();

                    // Apply in-memory lively
                    process.env[key] = value;

                    // Apply to Heroku
                    await herokuApiRequest('PATCH', '/apps/' + appName + '/config-vars', apiKey, { [key]: value });

                    // Also sync local .env if present
                    const env = readEnv();
                    env[key] = value;
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Heroku Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied lively in-memory and synced to Heroku!*'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'delete' || subCmd === 'del' || subCmd === 'remove') {
                    const key = remainingArgs[0];
                    if (!key) {
                        await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars heroku delete KEY`' }, { quoted: message });
                        return;
                    }

                    delete process.env[key];
                    await herokuApiRequest('PATCH', '/apps/' + appName + '/config-vars', apiKey, { [key]: null });

                    const env = readEnv();
                    delete env[key];
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Deleted ' + key + ' from Heroku and local environment!*'
                    }, { quoted: message });
                    return;
                }
            }

            // ==========================================
            // LOCAL / DYNAMIC .ENV COMMAND HANDLING
            // ==========================================
            if (subCmd === 'list') {
                const env = readEnv();
                let text = '📋 *Current Environment Variables (Local & Memory)*\n\n';
                const keys = Object.keys(env);
                if (keys.length === 0) {
                    text += '_No variables set in .env._';
                } else {
                    for (const key of keys.sort()) {
                        const val = process.env[key] !== undefined ? process.env[key] : env[key];
                        text += '🔹 *' + key + '*: `' + val + '`\n';
                    }
                }

                const { apiKey, appName } = await getHerokuCredentials();
                if (apiKey && appName) {
                    text += '\n☁️ *Heroku Linked:* `' + appName + '` (use `.pgvars heroku list`)';
                }

                text += '\n\n_💡 Changes apply instantly in runtime._';
                await sock.sendMessage(chatId, { text }, { quoted: message });
                return;
            }

            if (subCmd === 'update' || subCmd === 'set' || subCmd === 'add') {
                const input = remainingArgs.join(' ');
                if (!input.includes('=')) {
                    await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars set KEY=VALUE`' }, { quoted: message });
                    return;
                }

                const key = input.split('=')[0].trim();
                const value = input.split('=').slice(1).join('=').trim();

                // 1. Apply in-memory lively
                process.env[key] = value;

                // 2. Persist to local .env
                const env = readEnv();
                env[key] = value;
                writeEnv(env);

                // 3. If Heroku is configured, sync automatically
                let herokuSynced = false;
                const { apiKey, appName } = await getHerokuCredentials();
                if (apiKey && appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + appName + '/config-vars', apiKey, { [key]: value });
                        herokuSynced = true;
                    } catch {}
                }

                let reply = '✅ *Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied lively in runtime memory!*';
                if (herokuSynced) {
                    reply += '\n☁️ *Synced to Heroku app ' + appName + '*';
                }
                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
                return;
            }

            if (subCmd === 'delete' || subCmd === 'del' || subCmd === 'remove') {
                const key = remainingArgs[0];
                if (!key) {
                    await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars delete KEY`' }, { quoted: message });
                    return;
                }

                delete process.env[key];
                const env = readEnv();
                const existed = !!env[key];
                if (existed) {
                    delete env[key];
                    writeEnv(env);
                }

                // If Heroku is configured, sync delete
                let herokuSynced = false;
                const { apiKey, appName } = await getHerokuCredentials();
                if (apiKey && appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + appName + '/config-vars', apiKey, { [key]: null });
                        herokuSynced = true;
                    } catch {}
                }

                let reply = '✅ *Deleted ' + key + '!*\n⚡ *Removed from live runtime memory and .env*';
                if (herokuSynced) {
                    reply += '\n☁️ *Removed from Heroku app ' + appName + '*';
                }
                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
                return;
            }

        } catch (error) {
            console.error('PGVars Error:', error);
            await sock.sendMessage(chatId, { text: '❌ *Error:* ' + error.message }, { quoted: message });
        }
    }
};
