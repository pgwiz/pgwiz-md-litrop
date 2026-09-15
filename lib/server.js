const express = require('express');
const { createServer } = require('http');
const packageInfo = require('../package.json');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getAuthKey() {
    return process.env.DEBUG_KEY || process.env.DEBUG_PASSWORD || process.env.ADMIN_PASSWORD || process.env.PASSWORD || 'pgwiz';
}

function checkAuth(req) {
    const validKey = String(getAuthKey()).trim();
    const provided = req.query.key || req.query.auth || req.query.password || req.query.pass || req.query.token ||
                     req.headers['x-debug-key'] || req.headers['x-api-key'] ||
                     (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    
    if (provided && String(provided).trim() === validKey) {
        return true;
    }
    return false;
}

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
        <title>${packageInfo.name.toUpperCase()} Status</title>
        <style>
            :root { --primary: #25d366; --bg: #0f172a; --card-bg: rgba(30, 41, 59, 0.7); }
            body { 
                margin: 0; padding: 0; background: var(--bg); color: white; 
                font-family: 'Inter', system-ui, sans-serif;
                display: flex; justify-content: center; align-items: center; min-height: 100vh;
            }
            .container {
                background: var(--card-bg); backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1); padding: 30px;
                border-radius: 24px; width: 90%; max-width: 420px; text-align: center;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .status-badge {
                display: inline-flex; align-items: center; background: rgba(37, 211, 102, 0.1);
                color: var(--primary); padding: 5px 15px; border-radius: 50px;
                font-size: 0.8rem; font-weight: bold; margin-bottom: 20px;
            }
            .dot { height: 8px; width: 8px; background: var(--primary); border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px var(--primary); }
            h1 { margin: 0; font-size: 1.8rem; letter-spacing: 1px; }
            .desc { color: #94a3b8; margin: 10px 0 25px 0; font-size: 0.9rem; }
            .grid { display: grid; gap: 12px; }
            .item { 
                background: rgba(0,0,0,0.2); padding: 12px 18px; border-radius: 12px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .label { color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; }
            .val { font-weight: 600; font-family: monospace; color: #f1f5f9; }
            .btn-debug {
                display: inline-block; margin-top: 20px; padding: 10px 20px; background: rgba(37, 211, 102, 0.15);
                color: #25d366; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 0.85rem;
                border: 1px solid rgba(37, 211, 102, 0.3); transition: all 0.2s;
            }
            .btn-debug:hover { background: #25d366; color: #0f172a; }
            footer { margin-top: 25px; font-size: 0.7rem; color: #475569; letter-spacing: 1px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status-badge"><span class="dot"></span> SYSTEM ONLINE</div>
            <h1>${packageInfo.name.toUpperCase()}</h1>
            <p class="desc">${packageInfo.description}</p>
            
            <div class="grid">
                <div class="item"><span class="label">Version</span><span class="val">${packageInfo.version}</span></div>
                <div class="item"><span class="label">Author</span><span class="val">${packageInfo.author}</span></div>
                <div class="item"><span class="label">Uptime</span><span class="val">${uptimeString}</span></div>
            </div>

            <a href="/debug" class="btn-debug">📊 Open Status & LID Debug Console</a>

            <footer>POWERED BY pgwiz</footer>
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
    res.json({ status: 200, info: 'Message received (integration not implemented)' });
});

// Keep-alive ping endpoint - just logs access
app.get('/ping', async (req, res) => {
    const { printLog } = require('./print');
    printLog('info', '🔔 /ping endpoint accessed');

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
        if (wantsJson) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or missing debug key. Pass ?key=<DEBUG_KEY> or header X-Debug-Key.'
            });
        }

        // Render Password Login View
        return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Authentication Required - ${packageInfo.name.toUpperCase()}</title>
            <style>
                :root { --primary: #25d366; --bg: #0b0f19; --card-bg: rgba(23, 32, 51, 0.85); }
                body {
                    margin: 0; padding: 0; background: var(--bg); color: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    display: flex; justify-content: center; align-items: center; min-height: 100vh;
                }
                .card {
                    background: var(--card-bg); backdrop-filter: blur(16px);
                    border: 1px solid rgba(255,255,255,0.08); padding: 36px;
                    border-radius: 20px; width: 90%; max-width: 380px; text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }
                .lock-icon { font-size: 2.5rem; margin-bottom: 12px; }
                h2 { margin: 0 0 8px 0; font-size: 1.4rem; font-weight: 700; }
                p { color: #94a3b8; font-size: 0.88rem; margin: 0 0 24px 0; line-height: 1.4; }
                input[type="password"], input[type="text"] {
                    width: 100%; box-sizing: border-box; padding: 12px 16px; border-radius: 12px;
                    background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.15);
                    color: white; font-size: 0.95rem; margin-bottom: 16px; outline: none; transition: border-color 0.2s;
                }
                input:focus { border-color: var(--primary); }
                button {
                    width: 100%; padding: 12px; border-radius: 12px; border: none;
                    background: var(--primary); color: #0b0f19; font-weight: 700; font-size: 0.95rem;
                    cursor: pointer; transition: transform 0.1s, opacity 0.2s;
                }
                button:hover { opacity: 0.92; }
                button:active { transform: scale(0.98); }
                .hint { font-size: 0.75rem; color: #64748b; margin-top: 18px; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="lock-icon">🔒</div>
                <h2>Debug Console Access</h2>
                <p>Enter the debug key or password configured for this instance (<code>DEBUG_KEY</code>).</p>
                <form id="authForm" onsubmit="handleLogin(event)">
                    <input type="password" id="keyInput" placeholder="Enter debug key / password..." required autofocus />
                    <button type="submit">Unlock Console</button>
                </form>
                <div class="hint">Default key is configured in your platform environment variables.</div>
            </div>
            <script>
                // Auto-fill from localStorage if previously stored
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
        const activeKey = req.query.key || req.query.auth || req.query.password || 'pgwiz';

        if (wantsJson) {
            return res.json(debugData);
        }

        // Render Comprehensive Real-Time HTML Dashboard
        const sock = global.botInstance;
        const isBotConnected = debugData.bot.connected;
        const uptimeStr = debugData.server.uptimeFormatted;
        const cfg = debugData.autostatus;
        const stats = debugData.statistics;
        const distinctLids = debugData.distinctLids || [];
        const recentStatuses = debugData.recentStatuses || [];

        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Status & LID Debug Hub - ${packageInfo.name.toUpperCase()}</title>
            <style>
                :root {
                    --primary: #25d366; --primary-dark: #128c7e;
                    --bg: #0b0f19; --card-bg: rgba(23, 32, 51, 0.75);
                    --border: rgba(255, 255, 255, 0.08);
                    --text: #f8fafc; --text-muted: #94a3b8;
                    --accent-blue: #38bdf8; --accent-purple: #c084fc; --accent-amber: #fbbf24;
                }
                * { box-sizing: border-box; }
                body {
                    margin: 0; padding: 20px; background: var(--bg); color: var(--text);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    min-height: 100vh;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                header {
                    display: flex; justify-content: space-between; align-items: center;
                    flex-wrap: wrap; gap: 15px; margin-bottom: 25px; padding-bottom: 15px;
                    border-bottom: 1px solid var(--border);
                }
                .logo-area { display: flex; align-items: center; gap: 12px; }
                .logo-area h1 { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.5px; }
                .badge-connected {
                    display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
                    border-radius: 20px; font-size: 0.75rem; font-weight: 700;
                    background: ${isBotConnected ? 'rgba(37, 211, 102, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                    color: ${isBotConnected ? '#25d366' : '#ef4444'};
                    border: 1px solid ${isBotConnected ? 'rgba(37, 211, 102, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
                }
                .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
                .header-actions { display: flex; align-items: center; gap: 10px; }
                .btn {
                    padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
                    background: rgba(255,255,255,0.05); color: var(--text); font-size: 0.85rem;
                    font-weight: 600; cursor: pointer; text-decoration: none; transition: all 0.2s;
                    display: inline-flex; align-items: center; gap: 6px;
                }
                .btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
                .btn-primary { background: var(--primary); color: #0b0f19; border: none; font-weight: 700; }
                .btn-primary:hover { opacity: 0.9; }

                /* Grid Cards */
                .grid-cards {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 16px; margin-bottom: 25px;
                }
                .card {
                    background: var(--card-bg); backdrop-filter: blur(12px);
                    border: 1px solid var(--border); border-radius: 16px; padding: 20px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
                }
                .card-title {
                    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;
                    color: var(--text-muted); font-weight: 700; margin-bottom: 10px;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .card-value { font-size: 1.6rem; font-weight: 800; font-family: monospace; color: #fff; }
                .card-sub { font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; }

                /* Probe Section */
                .probe-box {
                    background: linear-gradient(135deg, rgba(37, 211, 102, 0.05), rgba(56, 189, 248, 0.05));
                    border: 1px solid rgba(37, 211, 102, 0.2); border-radius: 16px; padding: 20px; margin-bottom: 25px;
                }
                .probe-form {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) auto;
                    gap: 12px; align-items: end; margin-top: 12px;
                }
                .form-group { display: flex; flex-direction: column; gap: 5px; }
                .form-group label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
                .form-control {
                    padding: 10px 14px; border-radius: 10px; background: rgba(15, 23, 42, 0.8);
                    border: 1px solid var(--border); color: white; font-size: 0.9rem; outline: none;
                }
                .form-control:focus { border-color: var(--primary); }

                /* Tables */
                .section-title {
                    font-size: 1.1rem; font-weight: 700; margin: 30px 0 15px 0;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .table-container {
                    background: var(--card-bg); border: 1px solid var(--border);
                    border-radius: 16px; overflow-x: auto; margin-bottom: 25px;
                }
                table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem; }
                th {
                    padding: 14px 18px; background: rgba(0,0,0,0.25); color: var(--text-muted);
                    font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;
                    border-bottom: 1px solid var(--border);
                }
                td { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
                tr:last-child td { border-bottom: none; }
                tr:hover td { background: rgba(255,255,255,0.02); }
                .badge {
                    display: inline-block; padding: 3px 8px; border-radius: 6px;
                    font-size: 0.72rem; font-weight: 700; font-family: monospace;
                }
                .badge-lid { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }
                .badge-phone { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
                .badge-success { background: rgba(37, 211, 102, 0.15); color: #25d366; }
                .badge-warn { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
                .badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

                .code-pill {
                    background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 6px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 0.82rem; color: #e2e8f0;
                }
                #probeOutput {
                    margin-top: 15px; padding: 12px 16px; border-radius: 10px; font-family: monospace;
                    font-size: 0.85rem; display: none; word-break: break-all;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <div class="logo-area">
                        <h1>📱 ${packageInfo.name.toUpperCase()} <span style="color:var(--primary); font-weight:400; font-size:1rem;">Status & LID Console</span></h1>
                        <div class="badge-connected"><span class="dot"></span> ${isBotConnected ? 'WHATSAPP CONNECTED' : 'DISCONNECTED'}</div>
                    </div>
                    <div class="header-actions">
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:var(--text-muted); cursor:pointer;">
                            <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh(this.checked)"> Auto-Refresh (5s)
                        </label>
                        <button class="btn" onclick="location.reload()">🔄 Refresh</button>
                        <a href="/debug?key=${encodeURIComponent(activeKey)}&format=json" target="_blank" class="btn">JSON API</a>
                        <button class="btn" onclick="logout()">🔒 Exit</button>
                    </div>
                </header>

                <!-- Metrics Grid -->
                <div class="grid-cards">
                    <div class="card">
                        <div class="card-title">Bot Identity</div>
                        <div class="card-value" style="font-size:1.1rem; word-break:break-all;">${debugData.bot.id || 'Not Connected'}</div>
                        <div class="card-sub">LID: <span class="code-pill">${debugData.bot.lid || 'None'}</span></div>
                    </div>
                    <div class="card">
                        <div class="card-title">AutoStatus Mode</div>
                        <div class="card-value" style="color:var(--primary); font-size:1.3rem;">
                            Strategy ${cfg.strategy} <span style="font-size:1.4rem;">${cfg.reaction}</span>
                        </div>
                        <div class="card-sub">${cfg.strategyName}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Discovered Senders / LIDs</div>
                        <div class="card-value" style="color:var(--accent-purple);">${stats.distinctSenders}</div>
                        <div class="card-sub">${stats.distinctLidsCount} LIDs (@lid) | ${stats.distinctPhoneCount} Standard Numbers</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Activity & Uptime</div>
                        <div class="card-value" style="color:var(--accent-blue);">${stats.totalReceived} Received</div>
                        <div class="card-sub">👀 ${stats.totalViewed} Viewed | 💫 ${stats.totalReacted} Reacted | ⏱️ ${uptimeStr}</div>
                    </div>
                </div>

                <!-- Interactive Reaction Probe Playground -->
                <div class="probe-box">
                    <div style="font-weight:700; font-size:1rem; display:flex; align-items:center; gap:8px;">
                        🧪 Live Reaction Strategy Probe
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">
                        Trigger a real-time WhatsApp reaction to any cached status ID, sender LID, or arbitrary status key.
                    </div>
                    <form class="probe-form" onsubmit="executeProbe(event)">
                        <div class="form-group">
                            <label>Sender Participant / LID</label>
                            <input type="text" id="probeParticipant" class="form-control" placeholder="e.g. 62561080893516@lid" value="${distinctLids[0]?.id || ''}" required />
                        </div>
                        <div class="form-group">
                            <label>Status Message ID</label>
                            <input type="text" id="probeId" class="form-control" placeholder="e.g. A51454D735212E381FB8F7C57FEFCECC" value="${recentStatuses[0]?.id || ''}" required />
                        </div>
                        <div class="form-group" style="max-width:180px;">
                            <label>Strategy</label>
                            <select id="probeStrategy" class="form-control">
                                <option value="10" ${cfg.strategy === 10 ? 'selected' : ''}>Strategy 10 (Default)</option>
                                <option value="1">Strategy 1 (Classic Relay)</option>
                                <option value="2">Strategy 2 (Fresh Relay)</option>
                                <option value="3">Strategy 3 (Direct Relay)</option>
                                <option value="4">Strategy 4 (Direct Native)</option>
                                <option value="5">Strategy 5 (Normalized Relay)</option>
                                <option value="6">Strategy 6 (Native Broadcast)</option>
                                <option value="7">Strategy 7 (Native with Timestamp)</option>
                                <option value="8">Strategy 8 (Direct with Fresh Tag)</option>
                                <option value="9">Strategy 9 (Context Quote)</option>
                                <option value="11">Strategy 11 (Direct LID Relay)</option>
                                <option value="12">Strategy 12 (Direct LID Native)</option>
                                <option value="all">Test ALL Strategies (1-12)</option>
                            </select>
                        </div>
                        <div class="form-group" style="max-width:100px;">
                            <label>Emoji</label>
                            <input type="text" id="probeEmoji" class="form-control" value="${cfg.reaction || '💯'}" style="text-align:center;" />
                        </div>
                        <button type="submit" class="btn btn-primary" style="height:42px;">⚡ Send Probe</button>
                    </form>
                    <div id="probeOutput"></div>
                </div>

                <!-- Discovered LIDs Table -->
                <div class="section-title">
                    <span>👥 Discovered Senders & Active LIDs (${distinctLids.length})</span>
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">Identified from incoming status broadcasts</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Participant Identifier</th>
                                <th>Type</th>
                                <th>Contact Name</th>
                                <th>Statuses Sent</th>
                                <th>Last Seen</th>
                                <th>Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${distinctLids.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">No incoming status broadcasts detected yet. Status senders will appear here in real time as contacts post.</td></tr>' : ''}
                            ${distinctLids.map(d => `
                                <tr>
                                    <td><span class="code-pill">${d.id}</span></td>
                                    <td><span class="badge ${d.isLid ? 'badge-lid' : 'badge-phone'}">${d.isLid ? 'LID' : 'PHONE'}</span></td>
                                    <td>${d.pushName || '<span style="color:var(--text-muted)">Unknown</span>'}</td>
                                    <td><strong>${d.count}</strong></td>
                                    <td style="color:var(--text-muted); font-size:0.8rem;">${new Date(d.lastSeen).toLocaleTimeString()}</td>
                                    <td>
                                        <button class="btn" style="padding:4px 10px; font-size:0.75rem;" onclick="selectProbeTarget('${d.id}', '${d.lastMsgId || ''}')">🎯 Select for Probe</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Recent Status Activity Log -->
                <div class="section-title">
                    <span>📜 Real-Time Status Stream Log (Last ${recentStatuses.length})</span>
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">Live incoming broadcast status cache</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Sender</th>
                                <th>Type</th>
                                <th>Preview / Caption</th>
                                <th>View Status</th>
                                <th>Reaction Status</th>
                                <th>Probe</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentStatuses.length === 0 ? '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Waiting for new status broadcasts from WhatsApp...</td></tr>' : ''}
                            ${recentStatuses.map(s => `
                                <tr>
                                    <td style="color:var(--text-muted); font-size:0.78rem; white-space:nowrap;">${new Date(s.receivedAt).toLocaleTimeString()}</td>
                                    <td>
                                        <span class="badge ${s.isLid ? 'badge-lid' : 'badge-phone'}">${s.isLid ? 'LID' : 'PHONE'}</span>
                                        <span class="code-pill" style="margin-left:4px;">${s.sender}</span>
                                    </td>
                                    <td><span class="badge" style="background:rgba(255,255,255,0.06); color:#cbd5e1;">${s.type}</span></td>
                                    <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.preview || '<span style="color:var(--text-muted)">None</span>'}</td>
                                    <td>
                                        <span class="badge ${s.viewStatus === 'viewed' ? 'badge-success' : (s.viewStatus === 'disabled' ? 'badge-warn' : 'badge-danger')}">
                                            ${s.viewStatus === 'viewed' ? '👀 Viewed' : s.viewStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${s.reactStatus === 'reacted' ? 'badge-success' : (s.reactStatus === 'disabled' ? 'badge-warn' : 'badge-danger')}">
                                            ${s.reactStatus === 'reacted' ? ((s.emojiUsed || '💯') + ' Strategy ' + (s.strategyUsed || cfg.strategy)) : s.reactStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn" style="padding:4px 8px; font-size:0.75rem;" onclick="selectProbeTarget('${s.sender}', '${s.id}')">Probe</button>
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
                    document.getElementById('probeParticipant').value = participant;
                    if (id) document.getElementById('probeId').value = id;
                    document.getElementById('probeParticipant').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                async function executeProbe(e) {
                    e.preventDefault();
                    const participant = document.getElementById('probeParticipant').value.trim();
                    const id = document.getElementById('probeId').value.trim();
                    const strategy = document.getElementById('probeStrategy').value;
                    const emoji = document.getElementById('probeEmoji').value.trim() || '💯';
                    const output = document.getElementById('probeOutput');

                    output.style.display = 'block';
                    output.style.background = 'rgba(56, 189, 248, 0.1)';
                    output.style.border = '1px solid rgba(56, 189, 248, 0.3)';
                    output.style.color = '#38bdf8';
                    output.textContent = '🚀 Sending reaction probe to WhatsApp...';

                    try {
                        const url = '/dev-probe?key=' + encodeURIComponent(currentKey) + 
                                    '&participant=' + encodeURIComponent(participant) +
                                    '&id=' + encodeURIComponent(id) +
                                    '&strategy=' + encodeURIComponent(strategy) +
                                    '&emoji=' + encodeURIComponent(emoji);

                        const res = await fetch(url);
                        const json = await res.json();
                        if (res.ok) {
                            output.style.background = 'rgba(37, 211, 102, 0.15)';
                            output.style.border = '1px solid rgba(37, 211, 102, 0.3)';
                            output.style.color = '#25d366';
                            output.textContent = '✅ Probe sent successfully! Response: ' + JSON.stringify(json, null, 2);
                        } else {
                            output.style.background = 'rgba(239, 68, 68, 0.15)';
                            output.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                            output.style.color = '#ef4444';
                            output.textContent = '❌ Probe failed: ' + (json.error || JSON.stringify(json));
                        }
                    } catch (err) {
                        output.style.background = 'rgba(239, 68, 68, 0.15)';
                        output.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                        output.style.color = '#ef4444';
                        output.textContent = '❌ Network error executing probe: ' + err.message;
                    }
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
        res.status(500).send(`<h2>Error rendering debug console: ${e.message}</h2>`);
    }
});

// Dev diagnostic probe endpoint for triggering status reactions
app.all('/dev-probe', async (req, res) => {
    if (!checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Pass ?key=<DEBUG_KEY> or header X-Debug-Key' });
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
        const em = emoji || '💯';

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

// Standard cloud healthcheck endpoint (Koyeb, Render, AWS, Docker)
app.get(['/healthz', '/health'], (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        uptime: Math.floor(process.uptime()),
        botConnected: !!(global.botInstance && global.botInstance.user)
    });
});

module.exports = { app, server, PORT };
