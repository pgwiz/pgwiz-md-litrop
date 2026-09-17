const express = require('express');
const { createServer } = require('http');
const crypto = require('crypto');
const packageInfo = require('../package.json');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let tempAuthSession = {
    key: null,
    generatedAt: 0,
    expiresAt: 0,
    lastSentAt: 0
};

function hasEnvAuthKey() {
    const val = process.env.PANEL_PASSWORD || process.env.DEBUG_KEY || process.env.DEBUG_PASSWORD || process.env.ADMIN_PASSWORD || process.env.PASSWORD;
    return !!(val && String(val).trim().length > 0);
}

function getEnvAuthKey() {
    return process.env.PANEL_PASSWORD || process.env.DEBUG_KEY || process.env.DEBUG_PASSWORD || process.env.ADMIN_PASSWORD || process.env.PASSWORD || '';
}

function getOwnerJid() {
    try {
        const isOwnerOrSudo = require('./isOwner');
        if (typeof isOwnerOrSudo.getAllOwnerNumbers === 'function') {
            const list = isOwnerOrSudo.getAllOwnerNumbers();
            if (list && list.length > 0 && list[0]) {
                return `${String(list[0]).replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            }
        }
    } catch {}
    if (global.botInstance?.user?.id) {
        const num = global.botInstance.user.id.split(':')[0].replace(/[^0-9]/g, '');
        if (num) return `${num}@s.whatsapp.net`;
    }
    return null;
}

async function getOrIssueAuthKey() {
    if (hasEnvAuthKey()) {
        return getEnvAuthKey().trim();
    }

    const now = Date.now();
    if (!tempAuthSession.key || now >= tempAuthSession.expiresAt) {
        tempAuthSession.key = crypto.randomBytes(3).toString('hex').toUpperCase();
        tempAuthSession.generatedAt = now;
        tempAuthSession.expiresAt = now + 15 * 60 * 1000; // 15 min expiration
        tempAuthSession.lastSentAt = 0;
    }

    // Rate-limit device dispatch to once every 90 seconds
    if (now - tempAuthSession.lastSentAt > 90000) {
        const sock = global.botInstance;
        const ownerJid = getOwnerJid();
        if (sock && ownerJid && typeof sock.sendMessage === 'function') {
            try {
                await sock.sendMessage(ownerJid, {
                    text: `*SECURITY ACCESS KEY*\n\nTemporary Login Key: *${tempAuthSession.key}*\nValidity: 15 minutes.`
                });
                tempAuthSession.lastSentAt = now;
            } catch (err) {
                console.error('[PANEL AUTH] Failed to dispatch key to device:', err.message);
            }
        }
    }

    return tempAuthSession.key;
}

function checkAuth(req) {
    const provided = req.query.key || req.query.auth || req.query.password || req.query.pass || req.query.token ||
                     req.headers['x-debug-key'] || req.headers['x-api-key'] ||
                     (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (!provided) return false;

    const providedKey = String(provided).trim();

    if (hasEnvAuthKey()) {
        return providedKey === getEnvAuthKey().trim();
    }

    if (tempAuthSession.key && Date.now() < tempAuthSession.expiresAt) {
        return providedKey === tempAuthSession.key;
    }

    return false;
}

// Root Status Page - Minimalist & Geometric (Border Radius <= 6px, No Emojis)
app.get('/', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${packageInfo.name.toUpperCase()} SYSTEM STATUS</title>
        <style>
            :root {
                --bg: #090d16;
                --card: #0f172a;
                --border: rgba(255,255,255,0.08);
                --text: #f8fafc;
                --muted: #64748b;
                --primary: #0ea5e9;
                --emerald: #10b981;
            }
            body { 
                margin: 0; padding: 20px; background: var(--bg); color: var(--text); 
                font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                display: flex; justify-content: center; align-items: center; min-height: 100vh;
                box-sizing: border-box; -webkit-font-smoothing: antialiased;
            }
            .container {
                background: var(--card); border: 1px solid var(--border);
                padding: 32px; border-radius: 6px; width: 100%; max-width: 440px; text-align: left;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .status-badge {
                display: inline-flex; align-items: center; background: rgba(16, 185, 129, 0.1);
                color: var(--emerald); padding: 4px 10px; border-radius: 4px;
                font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
                border: 1px solid rgba(16, 185, 129, 0.25); margin-bottom: 20px;
            }
            .dot { height: 6px; width: 6px; background: var(--emerald); border-radius: 50%; margin-right: 8px; }
            h1 { margin: 0 0 6px 0; font-size: 1.3rem; font-weight: 800; letter-spacing: 0.04em; }
            .desc { color: var(--muted); margin: 0 0 24px 0; font-size: 0.85rem; line-height: 1.4; }
            .grid { display: grid; gap: 8px; margin-bottom: 24px; }
            .item { 
                background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.04);
                display: flex; justify-content: space-between; align-items: center;
            }
            .label { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
            .val { font-weight: 600; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.85rem; color: var(--text); }
            .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .btn {
                display: block; text-align: center; padding: 10px; background: #1e293b;
                color: var(--text); text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 0.78rem;
                letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid var(--border); transition: all 0.15s;
            }
            .btn:hover { background: #334155; border-color: var(--muted); }
            .btn-primary { background: #0284c7; border-color: #0284c7; color: white; }
            .btn-primary:hover { background: #0369a1; }
            footer { margin-top: 24px; font-size: 0.7rem; color: #475569; letter-spacing: 0.06em; text-transform: uppercase; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status-badge"><span class="dot"></span> SYSTEM ACTIVE</div>
            <h1>${packageInfo.name.toUpperCase()}</h1>
            <p class="desc">${packageInfo.description || 'Autonomous WhatsApp Multi-Device Instance'}</p>
            
            <div class="grid">
                <div class="item"><span class="label">VERSION</span><span class="val">${packageInfo.version}</span></div>
                <div class="item"><span class="label">RUNTIME</span><span class="val">Node.js ${process.version}</span></div>
                <div class="item"><span class="label">UPTIME</span><span class="val">${uptimeString}</span></div>
            </div>

            <div class="actions">
                <a href="/panel" class="btn btn-primary">CONTROLLER</a>
                <a href="/debug" class="btn">TELEMETRY</a>
            </div>

            <footer>INSTANCE RUNTIME MONITOR</footer>
        </div>
    </body>
    </html>
    `);
});

app.get('/process', (req, res) => {
    const { send } = req.query;
    if (!send) return res.status(400).json({ error: 'Missing send query' });
    res.json({ status: 'Received', data: send });
});

app.get('/chat', (req, res) => {
    const { message, to } = req.query;
    if (!message || !to) return res.status(400).json({ error: 'Missing message or to query' });
    res.json({ status: 200, info: 'Message received' });
});

app.get('/ping', async (req, res) => {
    res.json({
        status: 'success',
        message: 'Ping received',
        timestamp: new Date().toISOString()
    });
});

// Diagnostic & Status LIDs Debug Endpoint
app.get(['/debug', '/status-lids', '/dev-status'], async (req, res) => {
    const isAuthed = checkAuth(req);
    const wantsJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');

    if (!isAuthed) {
        if (!hasEnvAuthKey()) {
            getOrIssueAuthKey().catch(() => {});
        }

        if (wantsJson) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or missing access key.'
            });
        }

        // Render Password Login View (Zero Emojis, Radius <= 6px, No Reference to Dispatch)
        return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SYSTEM ACCESS</title>
            <style>
                :root { --bg: #090d16; --card: #0f172a; --border: rgba(255,255,255,0.08); --primary: #0ea5e9; --text: #f8fafc; --muted: #64748b; }
                body {
                    margin: 0; padding: 20px; background: var(--bg); color: var(--text);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                    display: flex; justify-content: center; align-items: center; min-height: 100vh;
                    box-sizing: border-box; -webkit-font-smoothing: antialiased;
                }
                .card {
                    background: var(--card); border: 1px solid var(--border); padding: 32px;
                    border-radius: 6px; width: 100%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                h2 { margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
                p { color: var(--muted); font-size: 0.82rem; margin: 0 0 20px 0; }
                .field { margin-bottom: 14px; }
                .field label { display: block; font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
                input[type="password"], input[type="text"] {
                    width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 4px;
                    background: rgba(0,0,0,0.3); border: 1px solid var(--border);
                    color: white; font-size: 0.9rem; outline: none; transition: border-color 0.15s; font-family: inherit;
                }
                input:focus { border-color: var(--primary); }
                button {
                    width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #0284c7;
                    background: #0284c7; color: white; font-weight: 700; font-size: 0.8rem;
                    cursor: pointer; transition: background 0.15s; letter-spacing: 0.06em; text-transform: uppercase;
                }
                button:hover { background: #0369a1; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>AUTHENTICATION REQUIRED</h2>
                <p>Provide access credentials to inspect telemetry.</p>
                <form id="authForm" onsubmit="handleLogin(event)">
                    <div class="field">
                        <label>ACCESS KEY</label>
                        <input type="password" id="keyInput" placeholder="Enter key..." required autofocus />
                    </div>
                    <button type="submit">AUTHENTICATE</button>
                </form>
            </div>
            <script>
                const savedKey = localStorage.getItem('pgwiz_debug_key');
                if (savedKey) {
                    window.location.href = window.location.pathname + '?key=' + encodeURIComponent(savedKey);
                }
                function handleLogin(e) {
                    e.preventDefault();
                    const key = document.getElementById('keyInput').value.trim();
                    if (key) {
                        localStorage.setItem('pgwiz_debug_key', key);
                        window.location.href = window.location.pathname + '?key=' + encodeURIComponent(key);
                    }
                }
            </script>
        </body>
        </html>
        `);
    }

    try {
        const autostatus = require('../plugins/autostatus');
        const debugData = await autostatus.getStatusDebugInfo();
        const activeKey = req.query.key || req.query.auth || req.query.password || '';

        debugData.liveStatusEvents = global.liveStatusEvents || [];

        if (wantsJson) {
            return res.json(debugData);
        }

        const sock = global.botInstance;
        const isBotConnected = debugData.bot.connected;
        const uptimeStr = debugData.server.uptimeFormatted;
        const cfg = debugData.autostatus;
        const stats = debugData.statistics;
        const recentHistory = debugData.recentHistory || [];

        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TELEMETRY CONSOLE</title>
            <style>
                :root {
                    --bg: #090d16;
                    --card-bg: #0f172a;
                    --border: rgba(255, 255, 255, 0.08);
                    --text: #f8fafc;
                    --text-muted: #64748b;
                    --primary: #0ea5e9;
                    --emerald: #10b981;
                    --amber: #f59e0b;
                    --rose: #ef4444;
                    --purple: #a855f7;
                }
                body {
                    margin: 0; padding: 20px; background: var(--bg); color: var(--text);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                    -webkit-font-smoothing: antialiased;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                header {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px;
                }
                .logo-area h1 { margin: 0 0 4px 0; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
                .badge-connected {
                    display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 4px;
                    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
                    background: ${isBotConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
                    color: ${isBotConnected ? 'var(--emerald)' : 'var(--rose)'};
                    border: 1px solid ${isBotConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
                }
                .dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; background: ${isBotConnected ? 'var(--emerald)' : 'var(--rose)'}; }
                .header-actions { display: flex; gap: 8px; align-items: center; }
                .btn {
                    padding: 8px 14px; border-radius: 4px; border: 1px solid var(--border);
                    background: #1e293b; color: var(--text); font-size: 0.75rem; font-weight: 600;
                    letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; text-decoration: none;
                    transition: all 0.15s;
                }
                .btn:hover { background: #334155; border-color: var(--text-muted); }
                .grid-cards {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 16px; margin-bottom: 24px;
                }
                .card {
                    background: var(--card-bg); border: 1px solid var(--border);
                    border-radius: 6px; padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                }
                .card-title {
                    font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
                    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
                }
                .card-value {
                    font-size: 1.4rem; font-weight: 800; font-family: ui-monospace, monospace; margin-bottom: 4px;
                }
                .card-sub { font-size: 0.75rem; color: var(--text-muted); }
                .section-header {
                    font-size: 0.85rem; font-weight: 700; letter-spacing: 0.06em;
                    text-transform: uppercase; margin: 24px 0 12px 0; color: var(--primary);
                }
                .table-container {
                    background: var(--card-bg); border: 1px solid var(--border);
                    border-radius: 6px; overflow-x: auto;
                }
                table { width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left; }
                th {
                    background: rgba(0,0,0,0.3); padding: 12px 16px; color: var(--text-muted);
                    font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
                    border-bottom: 1px solid var(--border);
                }
                td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
                tr:last-child td { border-bottom: none; }
                tr:hover td { background: rgba(255,255,255,0.02); }
                .badge {
                    display: inline-block; padding: 3px 6px; border-radius: 4px;
                    font-size: 0.7rem; font-weight: 700; font-family: ui-monospace, monospace;
                }
                .badge-lid { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
                .badge-phone { background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); }
                .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; }
                .badge-warn { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
                .code-pill {
                    background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;
                    font-family: ui-monospace, monospace; font-size: 0.75rem; color: #cbd5e1;
                }
                #probeOutput {
                    margin-top: 12px; padding: 12px 14px; border-radius: 4px; font-family: ui-monospace, monospace;
                    font-size: 0.8rem; display: none; word-break: break-all;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <div class="logo-area">
                        <h1>${packageInfo.name.toUpperCase()} TELEMETRY</h1>
                        <div class="badge-connected"><span class="dot"></span> ${isBotConnected ? 'CONNECTED' : 'DISCONNECTED'}</div>
                    </div>
                    <div class="header-actions">
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-muted); cursor:pointer;">
                            <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh(this.checked)"> REFRESH 5S
                        </label>
                        <a href="/panel?key=${encodeURIComponent(activeKey)}" class="btn">CONTROLLER</a>
                        <a href="/debug?key=${encodeURIComponent(activeKey)}&format=json" target="_blank" class="btn">JSON</a>
                        <button class="btn" onclick="logout()">EXIT</button>
                    </div>
                </header>

                <div class="grid-cards">
                    <div class="card">
                        <div class="card-title">INSTANCE IDENTITY</div>
                        <div class="card-value" style="font-size:1rem; word-break:break-all;">${debugData.bot.id || 'N/A'}</div>
                        <div class="card-sub">LID: <span class="code-pill">${debugData.bot.lid || 'NONE'}</span></div>
                    </div>
                    <div class="card">
                        <div class="card-title">STATUS ENGINE</div>
                        <div class="card-value" style="color:var(--primary); font-size:1.2rem;">
                            STRATEGY ${cfg.strategy}
                        </div>
                        <div class="card-sub">${cfg.strategyName}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">DISCOVERED IDENTIFIERS</div>
                        <div class="card-value" style="color:var(--purple);">${stats.distinctSenders}</div>
                        <div class="card-sub">${stats.lidSenders} LID | ${stats.phoneSenders} PHONE</div>
                    </div>
                    <div class="card">
                        <div class="card-title">EVENTS TRACKED</div>
                        <div class="card-value" style="color:var(--emerald);">${stats.totalViewed}</div>
                        <div class="card-sub">${stats.totalReacted} REACTIONS EXECUTED</div>
                    </div>
                </div>

                <div class="section-header">STATUS INTERACTION LOG</div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>TIMESTAMP</th>
                                <th>SENDER</th>
                                <th>IDENTIFIER</th>
                                <th>VIEW</th>
                                <th>REACTION</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentHistory.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">NO INTERACTION EVENTS RECORDED</td></tr>' : recentHistory.map(s => `
                                <tr>
                                    <td style="color:var(--text-muted);">${s.timeFormatted || new Date(s.timestamp).toLocaleTimeString()}</td>
                                    <td><span class="code-pill">${s.senderClean}</span></td>
                                    <td>
                                        <span class="badge ${s.senderType === 'lid' ? 'badge-lid' : 'badge-phone'}">
                                            ${s.senderType.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${s.viewStatus === 'viewed' ? 'badge-success' : 'badge-warn'}">
                                            ${s.viewStatus ? s.viewStatus.toUpperCase() : 'PENDING'}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${s.reactStatus === 'reacted' ? 'badge-success' : (s.reactStatus === 'disabled' ? 'badge-warn' : 'badge-danger')}">
                                            ${s.reactStatus ? s.reactStatus.toUpperCase() : 'NONE'}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn" style="padding:4px 8px; font-size:0.7rem;" onclick="selectProbeTarget('${s.sender}', '${s.id}')">PROBE</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <script>
                const currentKey = '${activeKey}';
                let refreshTimer = null;

                function toggleAutoRefresh(enabled) {
                    if (refreshTimer) clearInterval(refreshTimer);
                    if (enabled) {
                        refreshTimer = setInterval(() => {
                            location.reload();
                        }, 5000);
                    }
                }
                toggleAutoRefresh(true);

                function selectProbeTarget(participant, id) {
                    window.location.href = '/panel?key=' + encodeURIComponent(currentKey);
                }

                function logout() {
                    localStorage.removeItem('pgwiz_debug_key');
                    window.location.href = '/debug';
                }
            </script>
        </body>
        </html>
        `);
    } catch (e) {
        if (wantsJson) {
            return res.status(500).json({ error: e.message });
        }
        res.status(500).send(`<h2>Telemetry rendering error: ${e.message}</h2>`);
    }
});

app.all('/dev-probe', async (req, res) => {
    if (!checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid access key' });
    }

    try {
        const sock = global.botInstance;
        if (!sock) return res.status(503).json({ error: 'Bot socket not initialized' });
        const autostatus = require('../plugins/autostatus');
        const strategy = req.query.strategy || req.body?.strategy;
        const id = req.query.id || req.body?.id;
        const participant = req.query.participant || req.body?.participant;
        const emoji = req.query.emoji || req.body?.emoji;

        const targetKey = {
            remoteJid: 'status@broadcast',
            id: id || 'A51454D735212E381FB8F7C57FEFCECC',
            participant: participant || '62561080893516@lid',
            fromMe: false
        };
        const strat = strategy || '10';
        const em = emoji || (typeof autostatus.getStatusEmoji === 'function' ? autostatus.getStatusEmoji() : (settings.statusReaction || ''));

        let results = [];
        if (strat === 'all') {
            for (let s = 1; s <= 12; s++) {
                const sEmoji = autostatus.STRATEGY_DEFAULT_EMOJIS?.[s] || em;
                try {
                    await autostatus.executeReactionStrategy(sock, s, targetKey, sEmoji);
                    results.push({ strategy: s, emoji: sEmoji, status: 'success' });
                } catch (err) {
                    results.push({ strategy: s, emoji: sEmoji, status: 'error', error: err.message });
                }
                await new Promise(r => setTimeout(r, 1200));
            }
        } else {
            const sNum = parseInt(strat, 10);
            await autostatus.executeReactionStrategy(sock, sNum, targetKey, em);
            results.push({ strategy: sNum, emoji: em, status: 'success' });
        }
        res.json({ success: true, target: targetKey, results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

function isWebPanelEnabled(req) {
    const envVal = process.env.ENABLE_WEB_PANEL ?? process.env.WEB_PANEL ?? process.env.ENABLE_PANEL;
    if (envVal !== undefined && String(envVal).trim() !== '') {
        const s = String(envVal).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled';
    }
    if (process.env.PANEL_PASSWORD) return true;
    if (req && checkAuth(req)) return true;
    return true;
}

// Controller Web Panel - Environment Variable Gated (/panel)
app.get('/panel', async (req, res) => {
    if (!isWebPanelEnabled(req)) {
        return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PANEL RESTRICTED</title>
            <style>
                :root { --bg: #090d16; --card: #0f172a; --border: rgba(255,255,255,0.08); --danger: #ef4444; --text: #f8fafc; --muted: #64748b; }
                body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
                .box { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 32px; max-width: 440px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { margin-top: 0; color: var(--danger); font-size: 1.1rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
                p { color: var(--muted); font-size: 0.85rem; line-height: 1.5; margin: 0 0 14px 0; }
                code { background: rgba(0,0,0,0.4); padding: 3px 6px; border-radius: 4px; color: #38bdf8; font-family: ui-monospace, monospace; font-size: 0.8rem; }
                .btn { display: inline-block; padding: 10px 16px; background: #1e293b; color: white; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--border); }
                .btn:hover { background: #334155; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>ACCESS DISABLED</h2>
                <p>The management interface has been explicitly disabled for this deployment.</p>
                <p>To enable access, set the configuration parameter:</p>
                <p><code>ENABLE_WEB_PANEL=true</code></p>
                <a href="/" class="btn">RETURN TO HOME</a>
            </div>
        </body>
        </html>
        `);
    }

    if (!checkAuth(req)) {
        // Silently generate & dispatch temporary key to owner device if no env key configured
        if (!hasEnvAuthKey()) {
            getOrIssueAuthKey().catch(() => {});
        }

        return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SYSTEM ACCESS</title>
            <style>
                :root { --bg: #090d16; --card: #0f172a; --border: rgba(255,255,255,0.08); --primary: #0ea5e9; --text: #f8fafc; --muted: #64748b; }
                body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; -webkit-font-smoothing: antialiased; }
                .card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 32px; width: 100%; max-width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
                p { color: var(--muted); font-size: 0.82rem; margin: 0 0 20px 0; }
                .field { margin-bottom: 14px; }
                .field label { display: block; font-size: 0.7rem; font-weight: 700; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
                input { width: 100%; box-sizing: border-box; padding: 10px 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; color: white; font-size: 0.9rem; outline: none; font-family: inherit; }
                input:focus { border-color: var(--primary); }
                button { width: 100%; padding: 10px; background: #0284c7; color: white; font-weight: 700; border: 1px solid #0284c7; border-radius: 4px; cursor: pointer; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; transition: background 0.15s; }
                button:hover { background: #0369a1; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>SYSTEM ACCESS</h2>
                <p>Authentication required to access the management interface.</p>
                <form method="GET" action="/panel">
                    <div class="field">
                        <label>ACCESS KEY</label>
                        <input type="password" name="key" placeholder="Enter key..." autofocus required />
                    </div>
                    <button type="submit">AUTHENTICATE</button>
                </form>
            </div>
        </body>
        </html>
        `);
    }

    const key = req.query.key || req.headers['x-debug-key'] || '';

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${packageInfo.name.toUpperCase()} CONTROLLER</title>
        <style>
            :root {
                --bg: #090d16;
                --card: #0f172a;
                --border: rgba(255,255,255,0.08);
                --text: #f8fafc;
                --muted: #64748b;
                --primary: #0ea5e9;
                --emerald: #10b981;
                --amber: #f59e0b;
                --rose: #ef4444;
            }
            body {
                margin: 0; padding: 20px; background: var(--bg); color: var(--text);
                font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                -webkit-font-smoothing: antialiased;
            }
            .wrapper { max-width: 1100px; margin: 0 auto; }
            header {
                display: flex; justify-content: space-between; align-items: center;
                padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 24px;
            }
            .brand h1 { margin: 0 0 4px 0; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
            .brand span { font-size: 0.75rem; color: var(--muted); }
            .badge {
                display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 4px;
                font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
                background: rgba(16, 185, 129, 0.1); color: var(--emerald); border: 1px solid rgba(16, 185, 129, 0.25);
            }
            .dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; background: var(--emerald); }
            .dot.offline { background: var(--rose); }
            .grid-stats {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 14px; margin-bottom: 24px;
            }
            .card-stat {
                background: var(--card); border: 1px solid var(--border); border-radius: 6px;
                padding: 18px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            }
            .stat-lbl {
                font-size: 0.7rem; color: var(--muted); text-transform: uppercase;
                font-weight: 700; letter-spacing: 0.06em; margin-bottom: 6px;
            }
            .stat-val {
                font-size: 1.25rem; font-weight: 800; font-family: ui-monospace, monospace; color: white;
            }
            .controls-grid {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 16px; margin-bottom: 24px;
            }
            .card {
                background: var(--card); border: 1px solid var(--border); border-radius: 6px;
                padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            }
            .card-title {
                font-size: 0.82rem; font-weight: 800; margin: 0 0 6px 0;
                letter-spacing: 0.06em; text-transform: uppercase; color: var(--primary);
            }
            .card-desc { font-size: 0.78rem; color: var(--muted); margin: 0 0 16px 0; line-height: 1.4; }
            .mode-btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
            .btn-mode {
                padding: 10px; border: 1px solid var(--border); background: rgba(0,0,0,0.25);
                color: #cbd5e1; border-radius: 4px; font-weight: 700; cursor: pointer;
                transition: all 0.15s; text-align: center; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;
            }
            .btn-mode:hover { border-color: var(--primary); color: white; background: rgba(14, 165, 233, 0.1); }
            .btn-mode.active { background: rgba(14, 165, 233, 0.15); border-color: var(--primary); color: var(--primary); }
            .field { margin-bottom: 14px; }
            .field label {
                display: block; font-size: 0.7rem; font-weight: 700; color: var(--muted);
                letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px;
            }
            .field input, .field select, .field textarea {
                width: 100%; box-sizing: border-box; padding: 10px 12px; background: rgba(0,0,0,0.25);
                border: 1px solid var(--border); border-radius: 4px; color: white;
                font-family: inherit; font-size: 0.85rem; outline: none; transition: border-color 0.15s;
            }
            .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--primary); }
            .btn-action {
                width: 100%; padding: 11px; background: #0284c7; color: white;
                font-weight: 700; border: 1px solid #0284c7; border-radius: 4px; cursor: pointer;
                transition: background 0.15s; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase;
            }
            .btn-action:hover { background: #0369a1; }
            .btn-action.secondary {
                background: #1e293b; border-color: var(--border); color: var(--text);
            }
            .btn-action.secondary:hover { background: #334155; border-color: var(--muted); }
            .console-box {
                background: rgba(0,0,0,0.4); border: 1px solid var(--border); border-radius: 6px;
                padding: 14px; height: 180px; overflow-y: auto; font-family: ui-monospace, monospace;
                font-size: 0.78rem; color: #38bdf8; line-height: 1.5;
            }
            .log-item { margin-bottom: 4px; }
            .toast {
                position: fixed; bottom: 20px; right: 20px; padding: 10px 18px; border-radius: 4px;
                font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
                display: none; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <header>
                <div class="brand">
                    <h1>${packageInfo.name.toUpperCase()} CONTROLLER</h1>
                    <span>Autonomous Multi-Device Control Architecture</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span id="connBadge" class="badge"><span class="dot"></span>CONNECTING...</span>
                    <a href="/debug?key=${encodeURIComponent(key)}" style="padding: 8px 14px; background: #1e293b; color: #cbd5e1; text-decoration: none; border-radius: 4px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; border: 1px solid var(--border);">TELEMETRY</a>
                </div>
            </header>

            <div class="grid-stats">
                <div class="card-stat">
                    <div class="stat-lbl">BOT MODE</div>
                    <div id="statMode" class="stat-val">...</div>
                </div>
                <div class="card-stat">
                    <div class="stat-lbl">CONNECTED JID</div>
                    <div id="statJid" class="stat-val" style="font-size: 0.9rem; word-break: break-all;">...</div>
                </div>
                <div class="card-stat">
                    <div class="stat-lbl">MEMORY CONSUMPTION</div>
                    <div id="statRam" class="stat-val">...</div>
                </div>
                <div class="card-stat">
                    <div class="stat-lbl">INSTANCE UPTIME</div>
                    <div id="statUptime" class="stat-val">...</div>
                </div>
            </div>

            <div class="controls-grid">
                <!-- Card 1: Bot Mode Switcher -->
                <div class="card">
                    <div class="card-title">ACCESS CONTROL</div>
                    <div class="card-desc">Configure command execution scope across chats and contacts.</div>
                    <div class="mode-btn-group">
                        <button class="btn-mode" id="btnModePublic" onclick="setMode('public')">PUBLIC</button>
                        <button class="btn-mode" id="btnModePrivate" onclick="setMode('private')">PRIVATE</button>
                        <button class="btn-mode" id="btnModeGroups" onclick="setMode('groups')">GROUPS</button>
                        <button class="btn-mode" id="btnModeInbox" onclick="setMode('inbox')">DIRECT</button>
                    </div>
                </div>

                <!-- Card 2: AutoStatus Controller -->
                <div class="card">
                    <div class="card-title">STATUS ENGINE</div>
                    <div class="card-desc">Manage broadcast reading and automatic emoji reactions.</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                        <button class="btn-mode" id="toggleViewBtn" onclick="toggleStatusSetting('view')">VIEW: ACTIVE</button>
                        <button class="btn-mode" id="toggleReactBtn" onclick="toggleStatusSetting('react')">REACT: ACTIVE</button>
                    </div>
                    <div class="field">
                        <label>REACTION STRATEGY (1 TO 12)</label>
                        <select id="selectStrategy" onchange="updateStatusField('strategy', this.value)">
                            <option value="1">Strategy 1 (Multi-Vector Resilient Dispatch)</option>
                            <option value="10">Strategy 10 (Multi-Vector Resilient Dispatch)</option>
                            <option value="2">Strategy 2 (Fresh ID Broadcast)</option>
                            <option value="3">Strategy 3 (Direct Author Relay)</option>
                            <option value="4">Strategy 4 (Direct Author Native React)</option>
                            <option value="5">Strategy 5 (Phone Relay)</option>
                            <option value="6">Strategy 6 (Native Broadcast React)</option>
                            <option value="7">Strategy 7 (Native with Timestamp)</option>
                            <option value="8">Strategy 8 (Direct with Timestamp)</option>
                            <option value="9">Strategy 9 (Direct Quote-Status)</option>
                            <option value="11">Strategy 11 (Direct LID Relay)</option>
                            <option value="12">Strategy 12 (Direct LID Native React)</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>REACTION SYMBOL / EMOJI</label>
                        <input type="text" id="inputEmoji" value="" placeholder="Configured via environment" style="font-size: 0.9rem;" onchange="updateStatusField('emoji', this.value)" />
                    </div>
                </div>

                <!-- Card 3: WhatsApp Direct Dispatcher -->
                <div class="card">
                    <div class="card-title">MESSAGE DISPATCH</div>
                    <div class="card-desc">Send message stanzas directly to any phone number or group.</div>
                    <div class="field">
                        <label>DESTINATION JID / NUMBER</label>
                        <input type="text" id="dispatchTarget" placeholder="e.g. 254712345678 or 120363...@g.us" />
                    </div>
                    <div class="field">
                        <label>PAYLOAD CONTENT</label>
                        <textarea id="dispatchMsg" rows="3" placeholder="Enter message payload..."></textarea>
                    </div>
                    <button class="btn-action" onclick="sendMessage()">DISPATCH MESSAGE</button>
                </div>

                <!-- Card 4: System Actions -->
                <div class="card">
                    <div class="card-title">OPERATIONS</div>
                    <div class="card-desc">Execute runtime maintenance without service interruption.</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn-action secondary" onclick="reloadPlugins()">RELOAD ALL PLUGINS</button>
                        <button class="btn-action secondary" onclick="testProbe()">EXECUTE REACTION PROBE</button>
                    </div>
                </div>
            </div>

            <!-- Real-time Activity Terminal -->
            <div class="card" style="margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="card-title" style="margin: 0;">ACTIVITY LOG</div>
                    <span style="font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">INTERVAL 3S</span>
                </div>
                <div class="console-box" id="consoleBox">
                    <div class="log-item">Connecting to controller telemetry stream...</div>
                </div>
            </div>
        </div>

        <div id="toast" class="toast"></div>

        <script>
            const AUTH_KEY = "${encodeURIComponent(key)}";
            let statusConfig = { view: true, react: true, strategy: 10, emoji: '' };

            function showToast(msg, isError = false) {
                const t = document.getElementById('toast');
                t.style.display = 'block';
                t.style.background = isError ? '#ef4444' : '#10b981';
                t.style.color = '#ffffff';
                t.innerText = msg;
                setTimeout(() => { t.style.display = 'none'; }, 3000);
            }

            async function fetchPanelData() {
                try {
                    const res = await fetch('/api/panel/data?key=' + AUTH_KEY);
                    if (!res.ok) return;
                    const data = await res.json();

                    const badge = document.getElementById('connBadge');
                    if (data.connected) {
                        badge.innerHTML = '<span class="dot"></span>ONLINE';
                        badge.style.color = '#10b981';
                        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        badge.style.background = 'rgba(16, 185, 129, 0.1)';
                    } else {
                        badge.innerHTML = '<span class="dot offline"></span>DISCONNECTED';
                        badge.style.color = '#ef4444';
                        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        badge.style.background = 'rgba(239, 68, 68, 0.1)';
                    }

                    document.getElementById('statMode').innerText = (data.mode || 'public').toUpperCase();
                    document.getElementById('statJid').innerText = data.botJid || 'Disconnected';
                    document.getElementById('statRam').innerText = data.ram || 'N/A';
                    document.getElementById('statUptime').innerText = data.uptime || 'N/A';

                    ['public', 'private', 'groups', 'inbox'].forEach(m => {
                        const btn = document.getElementById('btnMode' + m.charAt(0).toUpperCase() + m.slice(1));
                        if (btn) {
                            if (data.mode === m) btn.classList.add('active');
                            else btn.classList.remove('active');
                        }
                    });

                    if (data.autoStatus) {
                        statusConfig = data.autoStatus;
                        const vBtn = document.getElementById('toggleViewBtn');
                        vBtn.innerText = statusConfig.view ? 'VIEW: ACTIVE' : 'VIEW: DISABLED';
                        vBtn.style.borderColor = statusConfig.view ? '#10b981' : '#ef4444';

                        const rBtn = document.getElementById('toggleReactBtn');
                        rBtn.innerText = statusConfig.react ? 'REACT: ACTIVE' : 'REACT: DISABLED';
                        rBtn.style.borderColor = statusConfig.react ? '#10b981' : '#ef4444';

                        document.getElementById('selectStrategy').value = String(statusConfig.strategy || 10);
                        document.getElementById('inputEmoji').value = statusConfig.emoji || '';
                    }

                    if (data.recentLogs && data.recentLogs.length > 0) {
                        const box = document.getElementById('consoleBox');
                        box.innerHTML = data.recentLogs.map(l => '<div class="log-item">[' + l.time + '] ' + l.msg + '</div>').join('');
                    }

                } catch (e) {
                    console.error('Data fetch error:', e);
                }
            }

            async function setMode(mode) {
                try {
                    const res = await fetch('/api/panel/action?key=' + AUTH_KEY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'set_mode', mode })
                    });
                    const d = await res.json();
                    if (d.success) {
                        showToast('MODE SET TO ' + mode.toUpperCase());
                        fetchPanelData();
                    } else {
                        showToast(d.error || 'FAILED TO CHANGE MODE', true);
                    }
                } catch (e) {
                    showToast(e.message, true);
                }
            }

            async function toggleStatusSetting(field) {
                statusConfig[field] = !statusConfig[field];
                saveStatusConfig();
            }

            async function updateStatusField(field, val) {
                statusConfig[field] = val;
                saveStatusConfig();
            }

            async function saveStatusConfig() {
                try {
                    const res = await fetch('/api/panel/action?key=' + AUTH_KEY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'set_autostatus', config: statusConfig })
                    });
                    const d = await res.json();
                    if (d.success) {
                        showToast('STATUS CONFIGURATION SAVED');
                        fetchPanelData();
                    } else {
                        showToast(d.error || 'FAILED TO SAVE CONFIGURATION', true);
                    }
                } catch (e) {
                    showToast(e.message, true);
                }
            }

            async function sendMessage() {
                const target = document.getElementById('dispatchTarget').value.trim();
                const text = document.getElementById('dispatchMsg').value.trim();
                if (!target || !text) return alert('Target and message required');

                try {
                    const res = await fetch('/api/panel/action?key=' + AUTH_KEY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'send_message', target, text })
                    });
                    const d = await res.json();
                    if (d.success) {
                        showToast('MESSAGE DISPATCHED');
                        document.getElementById('dispatchMsg').value = '';
                    } else {
                        showToast(d.error || 'DISPATCH FAILED', true);
                    }
                } catch (e) {
                    showToast(e.message, true);
                }
            }

            async function reloadPlugins() {
                try {
                    const res = await fetch('/api/panel/action?key=' + AUTH_KEY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'reload_plugins' })
                    });
                    const d = await res.json();
                    showToast('PLUGINS RELOADED (' + (d.count || 'ALL') + ' ACTIVE)');
                } catch (e) {
                    showToast(e.message, true);
                }
            }

            async function testProbe() {
                try {
                    const res = await fetch('/dev-probe?key=' + AUTH_KEY + '&strategy=' + (statusConfig.strategy || 10));
                    const d = await res.json();
                    showToast('REACTION PROBE EXECUTED');
                } catch (e) {
                    showToast(e.message, true);
                }
            }

            fetchPanelData();
            setInterval(fetchPanelData, 3000);
        </script>
    </body>
    </html>
    `);
});

// Panel Live Telemetry Data API
app.get('/api/panel/data', async (req, res) => {
    if (!checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const store = require('./lightweight_store');
        const autostatus = require('../plugins/autostatus');
        const sock = global.botInstance;

        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const mem = process.memoryUsage();
        const ramMb = `${Math.round(mem.rss / 1024 / 1024)} MB (Heap: ${Math.round(mem.heapUsed / 1024 / 1024)} MB)`;

        const mode = (store && typeof store.getBotMode === 'function') ? await store.getBotMode() : 'public';
        const asConfig = (autostatus && typeof autostatus.readConfig === 'function') ? await autostatus.readConfig() : {};

        const recentStatuses = (autostatus && autostatus.recentStatusHistory) ? autostatus.recentStatusHistory.slice(0, 30) : [];
        const recentLogs = recentStatuses.map(s => ({
            time: new Date(s.timestamp || Date.now()).toLocaleTimeString(),
            msg: `Status from ${s.participant ? s.participant.split('@')[0] : 'author'} (${s.participant?.includes('@lid') ? 'LID' : 'Phone'}) | View: ${s.viewStatus || 'OK'} | React: ${s.reactStatus || 'NONE'} (Strat ${s.strategyUsed || ''})`
        }));

        res.json({
            connected: !!(sock && sock.user),
            botJid: sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : 'Disconnected',
            botLid: sock?.user?.lid || 'N/A',
            mode: mode || 'public',
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            ram: ramMb,
            autoStatus: {
                view: asConfig.view !== false,
                react: asConfig.react !== false,
                strategy: asConfig.strategy || 1,
                emoji: asConfig.emoji || ''
            },
            recentLogs
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Panel Control Action Dispatcher API
app.post('/api/panel/action', async (req, res) => {
    if (!checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { action } = req.body;
        const store = require('./lightweight_store');
        const autostatus = require('../plugins/autostatus');
        const sock = global.botInstance;

        if (action === 'set_mode') {
            const { mode } = req.body;
            if (!['public', 'private', 'groups', 'inbox', 'self'].includes(mode)) {
                return res.status(400).json({ error: 'Invalid mode' });
            }
            if (store && typeof store.setBotMode === 'function') {
                await store.setBotMode(mode);
            }
            return res.json({ success: true, mode });
        }

        if (action === 'set_autostatus') {
            const { config } = req.body;
            if (config && autostatus && typeof autostatus.writeConfig === 'function') {
                const current = await autostatus.readConfig();
                const updated = { ...current, ...config };
                await autostatus.writeConfig(updated);
                return res.json({ success: true, config: updated });
            }
            return res.json({ success: true });
        }

        if (action === 'send_message') {
            const { target, text } = req.body;
            if (!sock) return res.status(503).json({ error: 'Bot socket not connected' });
            if (!target || !text) return res.status(400).json({ error: 'Target and text required' });

            let jid = target.trim();
            if (!jid.includes('@')) {
                jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            }

            await sock.sendMessage(jid, { text });
            return res.json({ success: true, jid });
        }

        if (action === 'reload_plugins') {
            const commandHandler = require('./commandHandler');
            if (commandHandler && typeof commandHandler.loadCommands === 'function') {
                commandHandler.loadCommands();
                return res.json({ success: true, count: commandHandler.commands.size });
            }
            return res.json({ success: true });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (e) {
        console.error('Panel action error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Standard cloud healthcheck endpoint (Koyeb, Render, AWS, Docker)
app.get(['/healthz', '/health'], (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        uptime: Math.floor(process.uptime()),
        botConnected: !!(global.botInstance && global.botInstance.user),
        panelEnabled: isWebPanelEnabled()
    });
});

module.exports = { app, server, PORT, getOrIssueAuthKey, checkAuth };
