const express = require('express');
const { createServer } = require('http');
const packageInfo = require('../package.json');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

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
                border-radius: 24px; width: 90%; max-width: 400px; text-align: center;
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

// Dev diagnostic probe endpoint for triggering status reactions
app.get('/dev-probe', async (req, res) => {
    try {
        const sock = global.botInstance;
        if (!sock) return res.status(503).json({ error: 'Bot socket not initialized' });
        const autostatus = require('../plugins/autostatus');
        const { strategy, id, participant, emoji } = req.query;
        const targetKey = {
            remoteJid: 'status@broadcast',
            id: id || 'A51454D735212E381FB8F7C57FEFCECC',
            participant: participant || '62561080893516@lid',
            fromMe: false
        };
        const strat = strategy || 'all';
        const em = emoji || '💚';

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
        res.json({ target: targetKey, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Standard cloud healthcheck endpoint (Koyeb, Render, AWS, Docker)
app.get(['/healthz', '/health'], (req, res) => {
    res.status(200).json({ status: 'OK', uptime: Math.floor(process.uptime()) });
});

module.exports = { app, server, PORT };
