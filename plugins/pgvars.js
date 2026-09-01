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
    try {
        let content = '';
        for (const [key, value] of Object.entries(env)) {
            let data = String(value);
            if (!data.startsWith('"') && (data.includes(' ') || data.includes('=') || data.includes('#') || data.includes(','))) {
                data = '"' + data + '"';
            }
            content += key + '=' + data + '\n';
        }
        fs.writeFileSync(envPath, content.trim() + '\n');
    } catch {}
}

// Get all runtime environment variables (process.env + .env)
function getAllRuntimeEnv() {
    const fileEnv = readEnv();
    const runtimeEnv = { ...fileEnv };

    // Standard bot keys to prioritize
    const importantKeys = [
        'SESSION_ID', 'BOT_NAME', 'OWNER_NUMBER', 'PREFIX', 'MODE', 'WORK_TYPE', 'ALWAYS_ONLINE',
        'AUTO_REACT', 'AUTOREACT', 'AUTO_REACTION',
        'AUTO_STATUS_VIEW', 'AUTO_STATUS_REACT', 'STATUS_EMOJIS', 'AUTO_STATUS_SAVE', 'AUTO_STATUS_DOWNLOAD',
        'MONGO_URL', 'POSTGRES_URL', 'MYSQL_URL', 'DB_URL',
        'HKEY', 'HEROKU_API_KEY', 'HAPP', 'HEROKU_APP_NAME',
        'KOYEB_API_TOKEN', 'KOYEB_SERVICE_NAME', 'KOYEB_SERVICE_ID',
        'PORT', 'NODE_ENV', 'UV_THREADPOOL_SIZE'
    ];

    importantKeys.forEach(k => {
        if (process.env[k] !== undefined) runtimeEnv[k] = process.env[k];
    });

    // Also include any user-set variables in process.env that don't look like internal OS vars
    Object.keys(process.env).forEach(k => {
        if (!k.startsWith('npm_') && !k.startsWith('NODE_') && !k.startsWith('PATH') && !k.startsWith('SHELL') && !k.startsWith('USER') && !k.startsWith('HOME') && !k.startsWith('PWD') && !k.startsWith('_')) {
            if (runtimeEnv[k] === undefined) runtimeEnv[k] = process.env[k];
        }
    });

    return runtimeEnv;
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

// Background sync helper for other plugins
async function syncCloudVars(varsToSync) {
    try {
        const heroku = await getHerokuCredentials();
        if (heroku.apiKey && heroku.appName) {
            await herokuApiRequest('PATCH', '/apps/' + heroku.appName + '/config-vars', heroku.apiKey, varsToSync).catch(() => {});
        }

        const koyeb = await getKoyebCredentials();
        if (koyeb.apiToken && koyeb.serviceId) {
            const svcRes = await koyebApiRequest('GET', '/services/' + koyeb.serviceId, koyeb.apiToken);
            if (svcRes?.service?.definition) {
                const def = svcRes.service.definition;
                let envArr = Array.isArray(def.env) ? def.env : [];
                for (const [key, value] of Object.entries(varsToSync)) {
                    const idx = envArr.findIndex(e => e.key === key);
                    if (idx >= 0) envArr[idx] = { key, value: String(value) };
                    else envArr.push({ key, value: String(value) });
                }
                def.env = envArr;
                await koyebApiRequest('PATCH', '/services/' + koyeb.serviceId, koyeb.apiToken, { definition: def }).catch(() => {});
            }
        }
    } catch {}
}

module.exports = {
    command: 'pgvars',
    aliases: ['setenv', 'getenv', 'pgvar', 'herokuvar', 'koyebvar', 'var', 'koyeb', 'heroku', 'env'],
    category: 'admin',
    description: 'Manage runtime & cloud environment variables dynamically',
    usage: '.pgvars [list|set KEY=VALUE|get KEY|delete KEY|heroku|koyeb]',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const invokedCmd = (context.command || '').toLowerCase();
        const firstArg = (args[0] || '').toLowerCase();

        const isHerokuTarget = invokedCmd === 'heroku' || invokedCmd === 'herokuvar' || firstArg === 'heroku' || firstArg === 'hk';
        const isKoyebTarget = invokedCmd === 'koyeb' || invokedCmd === 'koyebvar' || firstArg === 'koyeb' || firstArg === 'ky';
        const isExplicitPlatformArg = firstArg === 'heroku' || firstArg === 'hk' || firstArg === 'koyeb' || firstArg === 'ky';

        const subCmdIndex = isExplicitPlatformArg ? 1 : 0;
        const subCmd = (args[subCmdIndex] || '').toLowerCase();
        const remainingArgs = args.slice(subCmdIndex + 1);

        // If no args provided, show runtime overview & help
        if (!args || args.length === 0 || (!isHerokuTarget && !isKoyebTarget && subCmd === 'help')) {
            const allEnv = getAllRuntimeEnv();
            const autoView = allEnv.AUTO_STATUS_VIEW ?? 'true';
            const autoReact = allEnv.AUTO_STATUS_REACT ?? 'true';
            const emojis = allEnv.STATUS_EMOJIS || '❤️,🔥,✨,💯,🌟,⚡';
            const mode = allEnv.MODE || allEnv.WORK_TYPE || 'public';
            const prefix = allEnv.PREFIX || '.';
            const alwaysOn = allEnv.ALWAYS_ONLINE || 'false';

            let text = '⚙️ *PGVars - Runtime Environment Manager*\n\n';
            text += '*🟢 Active Bot Variables (In-Memory & Cloud):*\n';
            text += '• *`MODE`*: `' + mode + '`\n';
            text += '• *`PREFIX`*: `' + prefix + '`\n';
            text += '• *`ALWAYS_ONLINE`*: `' + alwaysOn + '`\n';
            text += '• *`AUTO_STATUS_VIEW`*: `' + autoView + '`\n';
            text += '• *`AUTO_STATUS_REACT`*: `' + autoReact + '`\n';
            text += '• *`STATUS_EMOJIS`*: `' + emojis + '`\n\n';
            text += '*🛠️ Commands:*\n';
            text += '• `.pgvars list` - Show all active variables\n';
            text += '• `.pgvars set KEY=VALUE` - Change variable lively\n';
            text += '• `.pgvars get KEY` - View specific variable\n';
            text += '• `.pgvars delete KEY` - Remove variable\n\n';
            text += '*☁️ Remote Cloud Dashboards (Optional):*\n';
            text += '• `.pgvars heroku <list|set|delete|auth>`\n';
            text += '• `.pgvars koyeb <list|set|delete|auth>`\n\n';
            text += '_💡 All changes take effect in runtime memory immediately without restarting._';

            await sock.sendMessage(chatId, { text }, { quoted: message });
            return;
        }

        try {
            // ==========================================
            // HEROKU REMOTE DASHBOARD HANDLING
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
                        text: '✅ *Heroku Authenticated!*\n\n📱 *App:* `' + appName + '`\n🔑 *API Key:* `' + apiKey.slice(0, 6) + '...***`'
                    }, { quoted: message });
                    return;
                }

                const { apiKey, appName } = await getHerokuCredentials();
                if (!apiKey || !appName) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Heroku credentials not found!*\n\nAuthenticate using:\n`.pgvars heroku auth <API_KEY> <APP_NAME>`'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'list' || subCmd === 'get' || subCmd === '') {
                    await sock.sendMessage(chatId, { text: '🔄 Fetching Heroku config vars...' }, { quoted: message });
                    const configVars = await herokuApiRequest('GET', '/apps/' + appName + '/config-vars', apiKey);
                    let text = '☁️ *Heroku Config Vars (' + appName + ')*\n\n';
                    const entries = Object.entries(configVars || {});
                    if (entries.length === 0) {
                        text += '_No config vars found._';
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
                        text: '✅ *Heroku Config Var Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied in-memory & synced to Heroku!*'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'delete' || subCmd === 'del') {
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
                    await sock.sendMessage(chatId, { text: '✅ *Deleted ' + key + ' from Heroku and runtime!*' }, { quoted: message });
                    return;
                }
            }

            // ==========================================
            // KOYEB REMOTE DASHBOARD HANDLING
            // ==========================================
            if (isKoyebTarget) {
                if (subCmd === 'auth') {
                    const apiToken = remainingArgs[0];
                    const serviceName = remainingArgs[1];
                    if (!apiToken || !serviceName) {
                        await sock.sendMessage(chatId, {
                            text: '❌ *Usage:* `.pgvars koyeb auth <API_TOKEN> <SERVICE_NAME>`'
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
                        text: '✅ *Koyeb Authenticated!*\n\n🚀 *Service:* `' + serviceName + '` (ID: `' + serviceId + '`)\n🔑 *API Token:* `' + apiToken.slice(0, 6) + '...***`'
                    }, { quoted: message });
                    return;
                }

                const { apiToken, serviceName, serviceId } = await getKoyebCredentials();
                if (!apiToken || !serviceId) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Koyeb API token not found!*\n\nAuthenticate using:\n`.pgvars koyeb auth <KOYEB_API_TOKEN> <SERVICE_NAME>`\n\n_💡 Tip: When running directly on Koyeb, simply use `.pgvars set KEY=VALUE` to update environment variables instantly without API keys._'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'list' || subCmd === 'get' || subCmd === '') {
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

                    const svcRes = await koyebApiRequest('GET', '/services/' + serviceId, apiToken);
                    if (svcRes?.service?.definition) {
                        const definition = svcRes.service.definition;
                        let envArr = Array.isArray(definition.env) ? definition.env : [];
                        const existingIndex = envArr.findIndex(e => e.key === key);
                        if (existingIndex >= 0) envArr[existingIndex] = { key, value };
                        else envArr.push({ key, value });
                        definition.env = envArr;
                        await koyebApiRequest('PATCH', '/services/' + serviceId, apiToken, { definition });
                    }

                    const env = readEnv();
                    env[key] = value;
                    writeEnv(env);

                    await sock.sendMessage(chatId, {
                        text: '✅ *Koyeb Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied lively in-memory & synced to Koyeb!*'
                    }, { quoted: message });
                    return;
                }

                if (subCmd === 'delete' || subCmd === 'del') {
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
                    await sock.sendMessage(chatId, { text: '✅ *Deleted ' + key + ' from Koyeb and runtime!*' }, { quoted: message });
                    return;
                }
            }

            // ==========================================
            // UNIVERSAL RUNTIME ENVIRONMENT HANDLING
            // ==========================================
            if (subCmd === 'list' || subCmd === 'show' || subCmd === 'all' || subCmd === 'env') {
                const allEnv = getAllRuntimeEnv();
                let text = '🌐 *Active Runtime Environment Variables*\n\n';

                const entries = Object.entries(allEnv);
                if (entries.length === 0) {
                    text += '_No active variables found._';
                } else {
                    entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
                        const valStr = String(v);
                        const masked = (k.includes('KEY') || k.includes('TOKEN') || k.includes('PASS') || k.includes('SECRET') || k.includes('SESSION') || k.includes('URL') || k.includes('URI'))
                            ? (valStr.length > 10 ? valStr.slice(0, 5) + '...' + valStr.slice(-4) : '********')
                            : valStr;
                        text += '• *`' + k + '`*: `' + masked + '`\n';
                    });
                }

                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    text += '\n☁️ *Heroku Linked:* `' + herokuCreds.appName + '`';
                }

                const koyebCreds = await getKoyebCredentials();
                if (koyebCreds.apiToken && koyebCreds.serviceId) {
                    text += '\n🚀 *Koyeb Linked:* `' + (koyebCreds.serviceName || koyebCreds.serviceId) + '`';
                }

                await sock.sendMessage(chatId, { text: text.trim() }, { quoted: message });
                return;
            }

            if (subCmd === 'get') {
                const key = (remainingArgs[0] || '').trim();
                if (!key) {
                    await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars get KEY`' }, { quoted: message });
                    return;
                }
                const val = process.env[key] ?? readEnv()[key];
                if (val === undefined) {
                    await sock.sendMessage(chatId, { text: 'ℹ️ *`' + key + '`* is not set.' }, { quoted: message });
                    return;
                }
                const masked = (key.includes('KEY') || key.includes('TOKEN') || key.includes('PASS') || key.includes('SECRET') || key.includes('SESSION'))
                    ? (val.length > 8 ? val.slice(0, 4) + '...' + val.slice(-4) : '********')
                    : val;
                await sock.sendMessage(chatId, { text: '🔹 *`' + key + '`*: `' + masked + '`' }, { quoted: message });
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

                // 2. Plugin-specific runtime updates
                if (key === 'AUTO_STATUS_VIEW' || key === 'AUTO_STATUS_READ' || key === 'AUTO_READ_STATUS') {
                    const parsed = parseEnvBool(value, true);
                    const cur = await store.getSetting('global', 'autoStatus') || {};
                    cur.enabled = parsed;
                    await store.saveSetting('global', 'autoStatus', cur).catch(() => {});
                } else if (key === 'AUTO_STATUS_REACT' || key === 'STATUS_REACT') {
                    const parsed = parseEnvBool(value, true);
                    const cur = await store.getSetting('global', 'autoStatus') || {};
                    cur.reactOn = parsed;
                    await store.saveSetting('global', 'autoStatus', cur).catch(() => {});
                } else if (key === 'STATUS_EMOJIS') {
                    await store.saveSetting('global', 'statusEmojis', value).catch(() => {});
                } else if (key === 'ALWAYS_ONLINE') {
                    await store.saveSetting('global', 'alwaysOnline', parseEnvBool(value, false)).catch(() => {});
                }

                // 3. Local .env file update
                const env = readEnv();
                env[key] = value;
                writeEnv(env);

                let reply = '✅ *Environment Variable Updated!*\n\n🔹 *' + key + '*: `' + value + '`\n⚡ *Applied lively in runtime memory!*';

                // 4. Auto-sync to Heroku if linked
                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + herokuCreds.appName + '/config-vars', herokuCreds.apiKey, { [key]: value });
                        reply += '\n☁️ *Synced to Heroku (' + herokuCreds.appName + ')*';
                    } catch (e) {
                        reply += '\n⚠️ *Heroku sync note:* ' + e.message;
                    }
                }

                // 5. Auto-sync to Koyeb if linked
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
                            reply += '\n🚀 *Synced to Koyeb (' + (koyebCreds.serviceName || koyebCreds.serviceId) + ')*';
                        }
                    } catch (e) {
                        reply += '\n⚠️ *Koyeb sync note:* ' + e.message;
                    }
                }

                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
                return;
            }

            if (subCmd === 'delete' || subCmd === 'del') {
                const key = (remainingArgs[0] || '').trim();
                if (!key) {
                    await sock.sendMessage(chatId, { text: '❌ *Usage:* `.pgvars delete KEY`' }, { quoted: message });
                    return;
                }

                delete process.env[key];
                const env = readEnv();
                delete env[key];
                writeEnv(env);

                let reply = '✅ *Deleted ' + key + ' from runtime environment!*';

                const herokuCreds = await getHerokuCredentials();
                if (herokuCreds.apiKey && herokuCreds.appName) {
                    try {
                        await herokuApiRequest('PATCH', '/apps/' + herokuCreds.appName + '/config-vars', herokuCreds.apiKey, { [key]: null });
                        reply += '\n☁️ *Deleted from Heroku*';
                    } catch {}
                }

                const koyebCreds = await getKoyebCredentials();
                if (koyebCreds.apiToken && koyebCreds.serviceId) {
                    try {
                        const svcRes = await koyebApiRequest('GET', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken);
                        if (svcRes?.service?.definition) {
                            const def = svcRes.service.definition;
                            if (Array.isArray(def.env)) {
                                def.env = def.env.filter(e => e.key !== key);
                                await koyebApiRequest('PATCH', '/services/' + koyebCreds.serviceId, koyebCreds.apiToken, { definition: def });
                                reply += '\n🚀 *Deleted from Koyeb*';
                            }
                        }
                    } catch {}
                }

                await sock.sendMessage(chatId, { text: reply }, { quoted: message });
                return;
            }

            // Fallback help
            await sock.sendMessage(chatId, {
                text: '❌ *Invalid .pgvars command!*\n\nType `.pgvars` for available options.'
            }, { quoted: message });

        } catch (error) {
            console.error('Error in pgvars command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error managing variables:* ' + error.message
            }, { quoted: message });
        }
    },

    syncCloudVars,
    getHerokuCredentials,
    getKoyebCredentials,
    readEnv,
    writeEnv,
    getAllRuntimeEnv
};
