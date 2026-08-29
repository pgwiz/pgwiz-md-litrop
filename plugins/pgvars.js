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

// ==================== HEROKU API ====================
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

// ==================== KOYEB API ====================
async function koyebApiRequest(method, endpoint, apiToken, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'app.koyeb.com',
            port: 443,
            path: '/v1' + endpoint,
            method: method,
            headers: {
                'Authorization': 'Bearer ' + apiToken,
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

async function getKoyebCredentials() {
    let apiToken = process.env.KOYEB_API_TOKEN || process.env.KOYEB_TOKEN || process.env.KOYEB_API_KEY || process.env.KOYEB_KEY || process.env.K_TOKEN || process.env.K_KEY;
    let serviceName = process.env.KOYEB_SERVICE_NAME || process.env.KOYEB_APP_NAME || process.env.KOYEB_SERVICE || process.env.KOYEB_APP || process.env.K_SERVICE || process.env.K_APP;
    let serviceId = process.env.KOYEB_SERVICE_ID;

    if (!apiToken || (!serviceName && !serviceId)) {
        const storedAuth = await store.getSetting('global', 'koyebAuth');
        if (storedAuth) {
            apiToken = apiToken || storedAuth.apiToken;
            serviceName = serviceName || storedAuth.serviceName;
            serviceId = serviceId || storedAuth.serviceId;
        }
    }

    // Auto-resolve service ID if only name was provided
    if (apiToken && !serviceId && serviceName) {
        try {
            const listRes = await koyebApiRequest('GET', '/services?limit=100', apiToken);
            if (listRes && Array.isArray(listRes.services)) {
                const target = listRes.services.find(s => s.name === serviceName || s.id === serviceName);
                if (target) {
                    serviceId = target.id;
                    serviceName = target.name || serviceName;
                }
            }
        } catch {}
    }

    if (apiToken && (serviceName || serviceId) && store && typeof store.saveSetting === 'function') {
        store.saveSetting('global', 'koyebAuth', { apiToken, serviceName, serviceId }).catch(() => {});
    }

    return { apiToken, serviceName, serviceId: serviceId || serviceName };
}

module.exports = {
    command: 'pgvars',
    aliases: ['setenv', 'getenv', 'pgvar', 'herokuvar', 'koyebvar', 'var'],
    category: 'admin',
    description: 'Manage environment variables dynamically (.env, Heroku, Koyeb)',
    usage: '.pgvars [heroku|koyeb] <list|set|delete|auth> [KEY=VALUE]',
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
            helpText += '*🚀 Koyeb Platform Commands:*\n';
            helpText += '• `.pgvars koyeb auth <API_TOKEN> <SERVICE_NAME>` - Save Koyeb credentials\n';
            helpText += '• `.pgvars koyeb list` - List Koyeb environment variables\n';
            helpText += '• `.pgvars koyeb set KEY=VALUE` - Update Koyeb variable\n';
            helpText += '• `.pgvars koyeb delete KEY` - Delete Koyeb variable\n\n';
            helpText += '_💡 Live changes take effect instantly in-memory without reboot._';
            await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
            return;
        }

        const targetPlatform = args[0].toLowerCase();
        const isHerokuTarget = targetPlatform === 'heroku' || targetPlatform === 'hk';
        const isKoyebTarget = targetPlatform === 'koyeb' || targetPlatform === 'ky';
        const isCloudTarget = isHerokuTarget || isKoyebTarget;

        const subCmdIndex = isCloudTarget ? 1 : 0;
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

                    process.env.HEROKU_API_KEY = apiKey;
                    process.env.HEROKU_APP_NAME = appName;
                    await store.saveSetting('global', 'herokuAuth', { apiKey, appName });

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

                if (subCmd === 'list' || subCmd === 'get') {
                    await sock.sendMessage(chatId, { text: '🔄 Fetching Heroku config vars...' }, { quoted: message });
                    const configVars = await herokuApiRequest('GET', '/apps/' + appName + '/config-vars', apiKey);

                    let text = '☁️ *Heroku Config Vars (' + appName + ')*\n\n';
                    const entries = Object.entries(configVars);
                    if (entries.length === 0) {
                        text += '_No configuration variables set._';
                    } else {
                        entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
                            const valStr = String(v);
                            const masked = (k.includes('KEY') || k.includes('TOKEN') || k.includes('PASS') || k.includes('SECRET') || k.includes('SESSION'))
                                ? (valStr.length > 8 ? valStr.slice(0, 4) + '...' + valStr.slice(-4) : '********')
                                : valStr;
                            text += '• *`' + k + '`*: `' + masked + '`\n';
                        });
                    }
                    await sock.sendMessage(chatId, { text: text.trim() }, { quoted: message });
                    return;
                }

                if (subCmd === 'set' || subCmd === 'update') {
                    const argStr = remainingArgs.join(' ');
                    const eqIndex = argStr.indexOf('=');
                    if (eqIndex <= 0) {
                        await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars heroku set KEY=VALUE`' }, { quoted: message });
                        return;
                    }

                    const key = argStr.substring(0, eqIndex).trim();
                    let value = argStr.substring(eqIndex + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    process.env[key] = value;
                    await herokuApiRequest('PATCH', '/apps/' + appName + '/config-vars', apiKey, { [key]: value });

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
            // KOYEB COMMAND HANDLING
            // ==========================================
            if (isKoyebTarget) {
                if (subCmd === 'auth') {
                    const apiToken = remainingArgs[0];
                    const serviceName = remainingArgs[1];
                    if (!apiToken || !serviceName) {
                        await sock.sendMessage(chatId, {
                            text: '❌ *Usage:* `.pgvars koyeb auth <API_TOKEN> <SERVICE_NAME_OR_ID>`'
                        }, { quoted: message });
                        return;
                    }

                    let serviceId = serviceName;
                    try {
                        const listRes = await koyebApiRequest('GET', '/services?limit=100', apiToken);
                        if (listRes && Array.isArray(listRes.services)) {
                            const target = listRes.services.find(s => s.name === serviceName || s.id === serviceName);
                            if (target) serviceId = target.id;
                        }
                    } catch {}

                    process.env.KOYEB_API_TOKEN = apiToken;
                    process.env.KOYEB_SERVICE_NAME = serviceName;
                    process.env.KOYEB_SERVICE_ID = serviceId;
                    await store.saveSetting('global', 'koyebAuth', { apiToken, serviceName, serviceId });

                    const env = readEnv();
                    env.KOYEB_API_TOKEN = apiToken;
                    env.KOYEB_SERVICE_NAME = serviceName;
                    env.KOYEB_SERVICE_ID = serviceId;
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Koyeb Authenticated!*\n\n🚀 *Service:* `' + serviceName + '` (ID: `' + serviceId + '`)\n🔑 *API Token:* `' + apiToken.slice(0, 6) + '...***`\n\nYou can now use `.pgvars koyeb list` and `.pgvars koyeb set KEY=VALUE`.'
                    }, { quoted: message });
                    return;
                }

                const { apiToken, serviceName, serviceId } = await getKoyebCredentials();
                if (!apiToken || !serviceId) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Koyeb credentials not found!*\n\nPlease authenticate first using:\n`.pgvars koyeb auth <KOYEB_API_TOKEN> <SERVICE_NAME>`'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'list' || subCmd === 'get') {
                    await sock.sendMessage(chatId, { text: '🔄 Fetching Koyeb environment variables...' }, { quoted: message });
                    const svcRes = await koyebApiRequest('GET', '/services/' + serviceId, apiToken);
                    const envList = svcRes?.service?.definition?.env || [];

                    let text = '🚀 *Koyeb Environment Vars (' + (serviceName || serviceId) + ')*\n\n';
                    if (envList.length === 0) {
                        text += '_No environment variables set._';
                    } else {
                        envList.forEach(item => {
                            const k = item.key;
                            const v = item.value || '';
                            const masked = (k.includes('KEY') || k.includes('TOKEN') || k.includes('PASS') || k.includes('SECRET') || k.includes('SESSION'))
                                ? (v.length > 8 ? v.slice(0, 4) + '...' + v.slice(-4) : '********')
                                : v;
                            text += '• *`' + k + '`*: `' + masked + '`\n';
                        });
                    }
                    await sock.sendMessage(chatId, { text: text.trim() }, { quoted: message });
                    return;
                }

                if (subCmd === 'set' || subCmd === 'update') {
                    const argStr = remainingArgs.join(' ');
                    const eqIndex = argStr.indexOf('=');
                    if (eqIndex <= 0) {
                        await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars koyeb set KEY=VALUE`' }, { quoted: message });
                        return;
                    }

                    const key = argStr.substring(0, eqIndex).trim();
                    let value = argStr.substring(eqIndex + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    process.env[key] = value;

                    // Fetch existing definition, update env array, and patch
                    const svcRes = await koyebApiRequest('GET', '/services/' + serviceId, apiToken);
                    if (!svcRes?.service?.definition) {
                        throw new Error('Failed to retrieve Koyeb service definition');
                    }

                    const definition = svcRes.service.definition;
                    let envArr = Array.isArray(definition.env) ? definition.env : [];
                    const existingIndex = envArr.findIndex(e => e.key === key);
                    if (existingIndex >= 0) {
                        envArr[existingIndex] = { key, value };
                    } else {
                        envArr.push({ key, value });
                    }
                    definition.env = envArr;

                    await koyebApiRequest('PATCH', '/services/' + serviceId, apiToken, { definition });

                    const env = readEnv();
                    env[key] = value;
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Koyeb Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied lively in-memory and synced to Koyeb!*'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'delete' || subCmd === 'del' || subCmd === 'remove') {
                    const key = remainingArgs[0];
                    if (!key) {
                        await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars koyeb delete KEY`' }, { quoted: message });
                        return;
                    }

                    delete process.env[key];

                    const svcRes = await koyebApiRequest('GET', '/services/' + serviceId, apiToken);
                    if (svcRes?.service?.definition) {
                        const definition = svcRes.service.definition;
                        if (Array.isArray(definition.env)) {
                            definition.env = definition.env.filter(e => e.key !== key);
                            await koyebApiRequest('PATCH', '/services/' + serviceId, apiToken, { definition });
                        }
                    }

                    const env = readEnv();
                    delete env[key];
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Deleted ' + key + ' from Koyeb and local environment!*'
                    }, { quoted: message });
                    return;
                }
            }

            // ==========================================
            // LOCAL .ENV COMMAND HANDLING & AUTO-SYNC
            // ==========================================
            if (subCmd === 'list' || subCmd === 'get') {
                const env = readEnv();
                let text = '📁 *Local Environment Variables (.env)*\n\n';
                const entries = Object.entries(env);
                if (entries.length === 0) {
                    text += '_No environment variables found in .env._';
                } else {
                    entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
                        const valStr = String(v);
                        const masked = (k.includes('KEY') || k.includes('TOKEN') || k.includes('PASS') || k.includes('SECRET') || k.includes('SESSION'))
                            ? (valStr.length > 8 ? valStr.slice(0, 4) + '...' + valStr.slice(-4) : '********')
                            : valStr;
                        text += '• *`' + k + '`*: `' + masked + '`\n';
                    });
                }

                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    text += '\n☁️ *Heroku Linked:* `' + herokuCreds.appName + '` (use `.pgvars heroku list`)';
                }

                const koyebCreds = await getKoyebCredentials();
                if (koyebCreds.apiToken && koyebCreds.serviceId) {
                    text += '\n🚀 *Koyeb Linked:* `' + (koyebCreds.serviceName || koyebCreds.serviceId) + '` (use `.pgvars koyeb list`)';
                }

                await sock.sendMessage(chatId, { text: text.trim() }, { quoted: message });
                return;
            }

            if (subCmd === 'set' || subCmd === 'update') {
                const argStr = remainingArgs.join(' ');
                const eqIndex = argStr.indexOf('=');
                if (eqIndex <= 0) {
                    await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars set KEY=VALUE`' }, { quoted: message });
                    return;
                }

                const key = argStr.substring(0, eqIndex).trim();
                let value = argStr.substring(eqIndex + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                // 1. In-memory live update
                process.env[key] = value;

                // 2. Local .env update
                const env = readEnv();
                env[key] = value;
                writeEnv(env);

                let reply = '✅ *Environment Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied in-memory and saved to .env*';

                // 3. Auto-sync to Heroku if configured
                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + herokuCreds.appName + '/config-vars', herokuCreds.apiKey, { [key]: value });
                        reply += '\n☁️ *Synced to Heroku app ' + herokuCreds.appName + '*';
                    } catch (e) {
                        reply += '\n⚠️ *Heroku sync notice:* ' + e.message;
                    }
                }

                // 4. Auto-sync to Koyeb if configured
                const koyebCreds = await getKoyebCredentials();
                if (koyebCreds.apiToken && koyebCreds.serviceId) {
                    try {
                        const svcRes = await koyebApiRequest('GET', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken);
                        if (svcRes?.service?.definition) {
                            const def = svcRes.service.definition;
                            let envArr = Array.isArray(def.env) ? def.env : [];
                            const idx = envArr.findIndex(e => e.key === key);
                            if (idx >= 0) envArr[idx] = { key, value };
                            else envArr.push({ key, value });
                            def.env = envArr;
                            await koyebApiRequest('PATCH', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken, { definition: def });
                            reply += '\n🚀 *Synced to Koyeb service ' + (koyebCreds.serviceName || koyebCreds.serviceId) + '*';
                        }
                    } catch (e) {
                        reply += '\n⚠️ *Koyeb sync notice:* ' + e.message;
                    }
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
                delete env[key];
                writeEnv(env);

                let reply = '✅ *Deleted ' + key + ' from environment and .env*';

                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + herokuCreds.appName + '/config-vars', herokuCreds.apiKey, { [key]: null });
                        reply += '\n☁️ *Removed from Heroku app ' + herokuCreds.appName + '*';
                    } catch {}
                }

                const koyebCreds = await getKoyebCredentials();
                if (koyebCreds.apiToken && koyebCreds.serviceId) {
                    try {
                        const svcRes = await koyebApiRequest('GET', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken);
                        if (svcRes?.service?.definition?.env) {
                            const def = svcRes.service.definition;
                            def.env = def.env.filter(e => e.key !== key);
                            await koyebApiRequest('PATCH', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken, { definition: def });
                            reply += '\n🚀 *Removed from Koyeb service ' + (koyebCreds.serviceName || koyebCreds.serviceId) + '*';
                        }
                    } catch {}
                }

                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
                return;
            }

        } catch (error) {
            console.error('Error in pgvars command:', error);
            await sock.sendMessage(chatId, { text: '❌ *Error managing variables:* ' + error.message }, { quoted: message });
        }
    }
};
