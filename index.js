/* process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; */

const fs = require('fs');
const path = require('path');

// Prevent restart loops by warning on repeated Bad MAC errors instead of deleting session files.
let lastBadMacWarning = 0;

// Stream-level suppression disabled on Koyeb/container platforms to prevent log duplication
// The console.log/error/warn overrides are sufficient for suppressing encryption logs
// On Koyeb, stream-level overrides cause output duplication in the custom logging layer

// Suppress Baileys internal session/prekey/BadMAC logs - AGGRESSIVE suppression
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Keywords that should be completely suppressed (as Set for faster lookup)
const SUPPRESS_KEYWORDS = new Set([
    'closing session', 'sessionentry', '_chains', 'registrationid', 'pendingprekey',
    'currentratchet', 'indexinfo', 'ephemeralkeypair', 'lastremoteephemeralkey',
    'basekey', 'chainkey', 'chaintype', 'messagekeys', 'signal key',
    'decrypt error', 'failed to decrypt', 'bad mac', 'session error',
    'messagecountererror', 'decrypted message', 'curve25519', 'hkdf-sha256',
    'prekey', 'signedprekey', 'identity key', 'ratchet', 'rootkey', 'noisekey',
    'signedbundle', 'xmppframing', 'sending presence', 'message counter'
]);

const shouldSuppress = (args) => {
    // First, check if any argument is a SessionEntry-like object or Buffer key
    for (const arg of args) {
        if (!arg) continue;

        if (typeof arg === 'object') {
            const name = arg.constructor?.name || '';

            // Direct object type checks
            if (name.includes('SessionEntry') || name.includes('Session') ||
                name.includes('Ratchet') || name.includes('Signal')) {
                return true;
            }

            // Check for session-related properties
            if (arg._chains || arg.currentRatchet || arg.registrationId || arg.pendingPreKey ||
                arg.ephemeralKeyPair || arg.lastRemoteEphemeralKey || arg.rootKey || arg.keyPair ||
                arg.noiseKey || arg.signedPreKey || arg.signedIdentityKey) {
                return true;
            }

            // Suppress large Buffers (likely encryption keys, > 20 bytes)
            if (Buffer.isBuffer(arg) && arg.length > 20) {
                return true;
            }
        }
    }

    // Check string arguments for suppression keywords
    for (const arg of args) {
        if (typeof arg !== 'string') continue;

        const lower = arg.toLowerCase();

        // Check for any suppression keyword
        for (const keyword of SUPPRESS_KEYWORDS) {
            if (lower.includes(keyword)) return true;
        }

        // Suppress things that look like object stringifications
        if (lower.includes('<buffer') || lower.includes('pubkey') || lower.includes('privkey')) {
            return true;
        }
    }

    return false;
};

console.log = (...args) => {
    if (shouldSuppress(args)) return;
    originalConsoleLog.apply(console, args);
};

console.error = (...args) => {
    if (shouldSuppress(args)) {
        const badMacFound = args.some(arg =>
            typeof arg === 'string' && arg.toLowerCase().includes('bad mac')
        );
        if (badMacFound) {
            const now = Date.now();
            if (now - lastBadMacWarning > 120000) {
                originalConsoleWarn('[AUTO-REPAIR] Bad MAC detected. Session key files will be refreshed on next startup.');
                lastBadMacWarning = now;
            }
        }
        return;
    }
    originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalConsoleWarn.apply(console, args);
};


require('./config');
require('./settings');

const { Writable } = require('stream');

// Create a null stream that discards all output for Pino
const nullStream = new Writable({
    write() {} // Do nothing - discard all output
});

const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const FileType = require('file-type');
const syntaxerror = require('syntax-error');
const axios = require('axios');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    Browsers,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
const { rmSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const store = require('./lib/lightweight_store');
const SaveCreds = require('./lib/session');
const { app, server, PORT } = require('./lib/server');
const { printLog } = require('./lib/print');
const {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus,
    handleCall
} = require('./lib/messageHandler');

const settings = require('./settings');
const commandHandler = require('./lib/commandHandler');

store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

commandHandler.loadCommands();
// console.log(chalk.greenBright(`✅ Loaded ${commandHandler.commands.size} Plugins`));

setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection completed');
    }
}, 60_000);

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        console.log(chalk.yellow('⚠️ RAM too high (>400MB), restarting bot...'));
        process.exit(1);
    }
}, 30_000);

let phoneNumber = global.PAIRING_NUMBER || process.env.PAIRING_NUMBER || "923051391005";
let owner = JSON.parse(fs.readFileSync('./data/owner.json'));

global.botname = process.env.BOT_NAME || "PGWIZ-MD";
global.themeemoji = "•";

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

let rl = null;
if (process.stdin.isTTY && !process.env.PAIRING_NUMBER) {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

const question = (text) => {
    if (rl && !rl.closed) {
        return new Promise((resolve) => rl.question(text, resolve));
    } else {
        return Promise.resolve(settings.ownerNumber || phoneNumber);
    }
};

process.on('exit', () => {
    if (rl && !rl.closed) {
        rl.close();
    }
});

process.on('SIGINT', () => {
    if (rl && !rl.closed) {
        rl.close();
    }
    process.exit(0);
});

function ensureSessionDirectory() {
    const sessionPath = path.join(__dirname, 'session');
    if (!existsSync(sessionPath)) {
        mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
}

function startupSessionCleanup() {
    try {
        const sessionPath = ensureSessionDirectory();
        const files = fs.readdirSync(sessionPath);
        let clearedCount = 0;

        for (const file of files) {
            if (file === 'creds.json') continue;

            const fullPath = path.join(sessionPath, file);
            try {
                const stat = fs.lstatSync(fullPath);
                if (stat.isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(fullPath);
                }
                clearedCount++;
            } catch {
                // Skip files that can't be removed
            }
        }

        if (clearedCount > 0) {
            printLog('warning', `[AUTO-REPAIR] Startup session cleanup removed ${clearedCount} stale session files to prevent Bad MAC.`);
        } else {
            printLog('info', '[AUTO-REPAIR] Startup session cleanup found no stale session files.');
        }
    } catch (error) {
        printLog('error', `Startup session cleanup failed: ${error.message}`);
    }
}

function hasValidSession() {
    try {
        const credsPath = path.join(__dirname, 'session', 'creds.json');

        if (!existsSync(credsPath)) {
            return false;
        }

        const fileContent = fs.readFileSync(credsPath, 'utf8');
        if (!fileContent || fileContent.trim().length === 0) {
            printLog('warning', 'creds.json exists but is empty');
            return false;
        }

        try {
            const creds = JSON.parse(fileContent);
            if (!creds.noiseKey || !creds.signedIdentityKey || !creds.signedPreKey) {
                printLog('warning', 'creds.json is missing required fields');
                return false;
            }

            // If we have valid keys and a me.id, accept the session
            // Baileys will handle registration during connection
            if (creds.me && creds.me.id) {
                printLog('success', `Session found for ${creds.me.id} (registered: ${creds.registered})`);
                return true;
            }

            if (creds.registered === false) {
                printLog('warning', 'Session not registered and no me.id - will need pairing');
                return false;
            }

            printLog('success', 'Valid session credentials found');
            return true;
        } catch (parseError) {
            printLog('warning', 'creds.json contains invalid JSON');
            return false;
        }
    } catch (error) {
        printLog('error', `Error checking session validity: ${error.message}`);
        return false;
    }
}

async function initializeSession() {
    ensureSessionDirectory();

    const txt = global.SESSION_ID || process.env.SESSION_ID;

    if (!txt) {
        printLog('warning', 'No SESSION_ID found in environment variables');
        if (hasValidSession()) {
            printLog('success', 'Existing session found. Using saved credentials');
            return true;
        }
        printLog('warning', 'No existing session found. Pairing code will be required');
        return false;
    }

    // Always refresh session from service to prevent staleness
    try {
        printLog('info', 'Refreshing session credentials from PGWIZ service...');
        await SaveCreds(txt);
        await delay(1500);

        if (hasValidSession()) {
            printLog('success', 'Session refreshed and verified');
            await delay(500);
            return true;
        } else {
            printLog('error', 'Session file not valid after refresh');
            return false;
        }
    } catch (error) {
        printLog('error', `Error refreshing session: ${error.message}`);
        // Fall back to existing session if available
        if (hasValidSession()) {
            printLog('warning', 'Using existing session (refresh failed)');
            return true;
        }
        return false;
    }
}

if (!server.listening) {
    server.listen(PORT, () => {
        printLog('success', `Server listening on port ${PORT}`);
    });
}

async function startBot() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion();

        ensureSessionDirectory();
        await delay(1000);

        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        // Create retry counter cache with short TTL (10 seconds) so old messages don't stay cached
        const msgRetryCounterCache = new NodeCache({ stdTTL: 10, checkperiod: 5 });

        const hasRegisteredCreds = state.creds && state.creds.registered !== undefined;
        printLog('info', `Credentials loaded. Registered: ${state.creds?.registered || false}`);

        const ghostMode = await store.getSetting('global', 'stealthMode');
        const isGhostActive = ghostMode && ghostMode.enabled;

        if (isGhostActive) {
            printLog('info', '👻 STEALTH MODE IS ACTIVE - Starting in stealth mode');
        }

        const botSocket = makeWASocket({
            version,
            logger: pino({ level: 'silent' }, nullStream), // Silent logger with null stream
            printQRInTerminal: !pairingCode,
            browser: Browsers.ubuntu('Chrome'), // Better for Linux/PM2 servers
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }, nullStream)),
            },
            markOnlineOnConnect: !isGhostActive,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false, // Disable history sync for real-time only
            retryRequestDelayMs: 2000, // Reduce retry delay from 5s to 2s
            fireInitQueries: false, // DISABLED: Don't wait for message history on startup - causes "waiting for message" hang
            getMessage: async (key) => {
                try {
                    // Add a 3 second timeout so we don't get stuck waiting for old messages
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 3000)
                    );

                    let jid = jidNormalizedUser(key.remoteJid);
                    const loadPromise = store.loadMessage(jid, key.id);
                    const msg = await Promise.race([loadPromise, timeoutPromise]);
                    return msg?.message || "";
                } catch (err) {
                    // If timeout or error, return empty string - Baileys will skip this message
                    return "";
                }
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000, // Aggressive keep-alive for stability
        });

        // Expose bot instance globally for /ping endpoint
        global.botInstance = botSocket;

        const originalSendPresenceUpdate = botSocket.sendPresenceUpdate;
        const originalReadMessages = botSocket.readMessages;
        const originalSendReceipt = botSocket.sendReceipt;
        const originalSendReadReceipt = botSocket.sendReadReceipt;

        botSocket.sendPresenceUpdate = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                printLog('info', '👻 Blocked presence update (stealth mode)');
                return;
            }
            return originalSendPresenceUpdate.apply(this, args);
        };

        botSocket.readMessages = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                return;
            }
            return originalReadMessages.apply(this, args);
        };

        if (originalSendReceipt) {
            botSocket.sendReceipt = async function (...args) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    return;
                }
                return originalSendReceipt.apply(this, args);
            };
        }

        if (originalSendReadReceipt) {
            botSocket.sendReadReceipt = async function (...args) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    return;
                }
                return originalSendReadReceipt.apply(this, args);
            };
        }

        const originalQuery = botSocket.query;
        botSocket.query = async function (node, ...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                if (node && node.tag === 'receipt') {
                    return;
                }
                if (node && node.attrs && (node.attrs.type === 'read' || node.attrs.type === 'read-self')) {
                    return;
                }
            }
            return originalQuery.apply(this, [node, ...args]);
        };

        botSocket.isGhostMode = async () => {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            return ghostMode && ghostMode.enabled;
        };

        botSocket.ev.on('creds.update', saveCreds);
        store.bind(botSocket.ev);

        botSocket.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                // Only process real-time messages, ignore history/append
                if (chatUpdate.type !== 'notify') return;

                const mek = chatUpdate.messages[0];
                if (!mek.message) return;

                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    handleStatus(botSocket, chatUpdate).catch(err => printLog('error', `AutoStatus Error: ${err.message}`));
                    return;
                }

                if (!botSocket.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup) return;
                }

                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                if (botSocket?.msgRetryCounterCache) {
                    botSocket.msgRetryCounterCache.clear();
                }

                try {
                    await handleMessages(botSocket, chatUpdate);
                } catch (err) {
                    printLog('error', `Error in handleMessages: ${err.message}`);
                    if (mek.key && mek.key.remoteJid) {
                        await botSocket.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.',
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: settings.newsletterJid || '120363319098372999@newsletter',
                                    newsletterName: settings.newsletterName || 'PGWIZ-MD',
                                    serverMessageId: -1
                                }
                            }
                        }).catch(console.error);
                    }
                }
            } catch (err) {
                printLog('error', `Error in messages.upsert: ${err.message}`);
            }
        });

        botSocket.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return decode.user && decode.server && decode.user + '@' + decode.server || jid;
            } else return jid;
        };

        botSocket.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = botSocket.decodeJid(contact.id);
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
            }
        });

        botSocket.getName = (jid, withoutContact = false) => {
            id = botSocket.decodeJid(jid);
            withoutContact = botSocket.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {};
                if (!(v.name || v.subject)) v = botSocket.groupMetadata(id) || {};
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
            });
            else v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === botSocket.decodeJid(botSocket.user.id) ?
                botSocket.user :
                (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        };

        botSocket.public = true;
        botSocket.serializeM = (m) => smsg(botSocket, m, store);

        const isRegistered = state.creds?.registered === true;
        const hasValidMe = state.creds?.me?.id ? true : false;

        // If we have me.id (from session service), trust it and attempt connection
        // No need for manual pairing - Baileys will handle registration during connection
        if (hasValidMe) {
            printLog('info', `Session has me.id: ${state.creds.me.id} (registered: ${isRegistered}) - attempting connection...`);
            if (rl && !rl.closed) {
                rl.close();
                rl = null;
            }
        } else if (pairingCode) {
            // Only prompt for pairing if we have NO me.id at all (fresh start)
            if (useMobile) throw new Error('Cannot use pairing code with mobile api');

            printLog('warning', 'No session found. Pairing code required');

            let phoneNumberInput;
            if (!!global.phoneNumber) {
                phoneNumberInput = global.phoneNumber;
            } else if (process.env.PAIRING_NUMBER) {
                phoneNumberInput = process.env.PAIRING_NUMBER;
                printLog('info', `Using phone number from environment: ${phoneNumberInput}`);
            } else if (rl && !rl.closed) {
                phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 6281376552730 (without + or spaces) : `)));
            } else {
                phoneNumberInput = phoneNumber;
                printLog('info', `Using default phone number: ${phoneNumberInput}`);
            }

            phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '');

            const pn = require('awesome-phonenumber');
            if (!pn('+' + phoneNumberInput).isValid()) {
                printLog('error', 'Invalid phone number format');

                if (rl && !rl.closed) {
                    rl.close();
                }
                process.exit(1);
            }

            setTimeout(async () => {
                try {
                    let code = await botSocket.requestPairingCode(phoneNumberInput);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
                    printLog('success', `Pairing code generated: ${code}`);

                    if (rl && !rl.closed) {
                        rl.close();
                        rl = null;
                    }
                } catch (error) {
                    printLog('error', `Failed to get pairing code: ${error.message}`);
                }
            }, 3000);
        } else {
            printLog('warning', 'Waiting for connection to establish...');
            if (rl && !rl.closed) {
                rl.close();
                rl = null;
            }
        }

        botSocket.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;

            if (qr) {
                printLog('info', 'QR Code generated. Please scan with WhatsApp');
            }

            if (connection === 'connecting') {
                printLog('connection', 'Connecting to WhatsApp...');
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                const errorName = lastDisconnect?.error?.message || 'Unknown Error';

                printLog('error', `Connection closed - Status:${reason} (${errorName})`);

                if (reason === 440) { // Conflict / Duplicate Session
                    console.log(chalk.bold.redBright(`⚠️  SESSION CONFLICT (Status 440)`));
                    console.log(chalk.red(`   Another instance is already using this session.`));
                    console.log(chalk.red(`   Please stop other running bots (Local, Koyeb, etc).`));
                    console.log(chalk.red(`   Waiting 30 seconds before reconnect attempt...`));
                    // For 440 errors, wait much longer and exit aggressively
                    await delay(30000);
                    process.exit(1); // Force restart to clear socket state
                } else if (reason === 401) { // Logged out
                    console.log(chalk.redBright(`⚠️  Session Logged Out. Please re-pair.`));
                }
            }

            if (connection == "open") {
                global.botConnectedTime = Date.now(); // Track connection time for old message filtering
                printLog('success', 'Bot connected successfully!');
                const { startAutoBio } = require('./plugins/a-setbio');
                startAutoBio(botSocket);
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    printLog('info', '👻 STEALTH MODE ACTIVE - Bot is in stealth mode');
                    console.log(chalk.gray('• No online status'));
                    console.log(chalk.gray('• No typing indicators'));
                }

                // console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(botSocket.user, null, 2))); // Verbose

                try {
                    const botNumber = botSocket.user.id.split(':')[0] + '@s.whatsapp.net';
                    const ghostStatus = (ghostMode && ghostMode.enabled) ? '\n👻 Stealth Mode: ACTIVE' : '';

                    await botSocket.sendMessage(botNumber, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!${ghostStatus}\n\n✅Make sure to join below channel`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363319098372999@newsletter',
                                newsletterName: 'PGWIZ-MD',
                                serverMessageId: -1
                            }
                        }
                    });

                    // --- Startup debug: send quick health-check to primary owner ---
                    try {
                        if (Array.isArray(owner) && owner.length) {
                            const primary = owner[0];
                            const ownerJid = primary.includes('@') ? primary : `${primary}@s.whatsapp.net`;

                            // keep an in-memory debug check pending state (expires in 10 minutes)
                            global.startupDebug = {
                                pending: true,
                                ownerJids: [ownerJid],
                                startedAt: Date.now(),
                                expiresAt: Date.now() + 10 * 60 * 1000
                            };

                            await botSocket.sendMessage(ownerJid, {
                                text: '🤖 Startup check — reply to this message to confirm bot status.\n\nReply with `.menu` to verify the bot is responding.',
                            });

                            printLog('info', `Startup debug message sent to ${ownerJid.split('@')[0]}`);
                        }
                    } catch (e) {
                        printLog('error', `Startup debug send failed: ${e.message}`);
                    }

                } catch (error) {
                    printLog('error', `Failed to send connection message: ${error.message}`);
                }


                // Verbose startup banner disabled
                // await delay(1999);
                // console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'PGWIZ-MD'} ]`)}\n\n`));
                // console.log(chalk.cyan(`< ================================================== >`));
                // console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: pgwiz`));
                // console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: pgwiz`));
                // console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`));
                // console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: ${settings.botOwner}`));
                // console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`));
                // console.log(chalk.blue(`Bot Version: ${settings.version}`));
                // console.log(chalk.cyan(`Loaded Commands: ${commandHandler.commands.size}`));
                // console.log(chalk.cyan(`Prefixes: ${settings.prefixes.join(', ')}`));
                // console.log(chalk.gray(`Backend: ${store.getStats().backend}`));
                // console.log();
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                const statusCode = lastDisconnect?.error?.output?.statusCode;

                printLog('error', `Connection closed - Status: ${statusCode}`);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync('./session', { recursive: true, force: true });
                        printLog('warning', 'Session logged out. Please re-authenticate');
                    } catch (error) {
                        printLog('error', `Error deleting session: ${error.message}`);
                    }
                }

                // For non-440 errors, use exponential backoff
                if (shouldReconnect && statusCode !== 440) {
                    const waitTime = 8000; // Wait 8 seconds for other errors
                    printLog('connection', `Reconnecting in ${waitTime/1000} seconds...`);
                    await delay(waitTime);
                    startBot();
                }
            }
        });

        botSocket.ev.on('call', async (calls) => {
            await handleCall(botSocket, calls);
        });

        botSocket.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(botSocket, update);
        });

        botSocket.ev.on('status.update', async (status) => {
            await handleStatus(botSocket, status);
        });

        botSocket.ev.on('messages.reaction', async (reaction) => {
            await handleStatus(botSocket, reaction);
        });

        // ===== PERFORMANCE & HEALTH MONITORING =====
        // Silent WebSocket health check - reconnects without sending messages
        let lastActivityTime = Date.now();
        const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
        
        botSocket.ev.on('messages.upsert', () => {
            lastActivityTime = Date.now();
        });

        botSocket.ev.on('messages.update', () => {
            lastActivityTime = Date.now();
        });

        // Silent health check every 5 minutes (no messages to user)
        const healthCheckInterval = setInterval(async () => {
            try {
                const wsState = botSocket?.ws?.readyState;
                const isConnected = botSocket?.user !== undefined;
                
                // Only log in debug, don't message user
                if (!isConnected || wsState !== 1) {
                    console.log(`[HEALTH] WebSocket unhealthy - attempting silent reconnect (state: ${wsState})`);
                    // Silently attempt to reconnect by resending presence
                    try {
                        await botSocket.sendPresenceUpdate('available');
                    } catch (e) {
                        // Fail silently, Baileys will handle reconnection
                    }
                }
            } catch (err) {
                // Silently ignore errors, don't interrupt the bot
            }
        }, HEALTH_CHECK_INTERVAL);

        // Scheduled restart every 6 hours to prevent memory creep
        const scheduledRestartInterval = setInterval(() => {
            printLog('info', '🔄 Scheduled 6-hour restart to maintain stability...');
            clearInterval(healthCheckInterval);
            clearInterval(scheduledRestartInterval);
            process.exit(0);
        }, 6 * 60 * 60 * 1000); // Every 6 hours

        // Garbage collection every 30 minutes
        const gcInterval = setInterval(() => {
            if (global.gc) {
                global.gc();
                const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
                console.log(`[GC] Garbage collection completed (RAM: ${memUsage}MB)`);
            }
        }, 30 * 60 * 1000); // Every 30 minutes

        return botSocket;
    } catch (error) {
        printLog('error', `Error in startBot: ${error.message}`);

        if (rl && !rl.closed) {
            rl.close();
            rl = null;
        }

        await delay(5000);
        startBot();
    }
}


async function main() {
    printLog('info', 'Starting PGWIZ-MD BOT...');
    startupSessionCleanup();

    try {
        const { applyStartupAutoStatusPolicy } = require('./plugins/autostatus');
        await applyStartupAutoStatusPolicy();
    } catch (error) {
        printLog('error', `Auto status startup policy failed: ${error.message}`);
    }

    const sessionReady = await initializeSession();

    if (sessionReady) {
        printLog('success', 'Session initialization complete. Starting bot...');
    } else {
        printLog('warning', 'Session initialization incomplete. Will attempt pairing...');
    }

    await delay(3000);

    startBot().catch(error => {
        printLog('error', `Fatal error: ${error.message}`);

        if (rl && !rl.closed) {
            rl.close();
        }

        process.exit(1);
    });
}

main();


const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
    //  console.log('🧹 Temp folder auto-cleaned');
}, 1 * 60 * 60 * 1000);

// CPU throttling detection and monitoring
setInterval(() => {
    try {
        const os = require('os');
        const cpus = os.cpus();
        if (!cpus || cpus.length === 0) return;

        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        }

        const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

        // Log if CPU is above 85% (significant throttling risk)
        if (cpuUsage > 85) {
            console.warn(chalk.yellow(`⚠️  HIGH CPU USAGE: ${cpuUsage}% - Server may be throttling performance`));
        }

        // Check for system slowness indicators every 2 minutes
        if (!global.cpuMonitor) global.cpuMonitor = { counts: [] };
        global.cpuMonitor.counts.push(cpuUsage);
        if (global.cpuMonitor.counts.length > 10) global.cpuMonitor.counts.shift();

        const avgCpu = global.cpuMonitor.counts.reduce((a, b) => a + b, 0) / global.cpuMonitor.counts.length;
        if (avgCpu > 80 && global.cpuMonitor.counts.length === 10) {
            console.warn(chalk.red(`🔥 SUSTAINED HIGH CPU: ${avgCpu.toFixed(1)}% average - Bot may be CPU-throttled on this server`));
        }
    } catch (err) {
        // Silently ignore CPU monitoring errors
    }
}, 2 * 60 * 1000); // Every 2 minutes

const folders = [
    path.join(__dirname, './lib'),
    path.join(__dirname, './plugins')
];

let totalFiles = 0;
let okFiles = 0;
let errorFiles = 0;

folders.forEach(folder => {
    if (!fs.existsSync(folder)) return;

    fs.readdirSync(folder)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
            totalFiles++;
            const filePath = path.join(folder, file);

            try {
                const code = fs.readFileSync(filePath, 'utf-8');
                const err = syntaxerror(code, file, {
                    sourceType: 'script',
                    allowAwaitOutsideFunction: true
                });

                if (err) {
                    console.error(chalk.red(`❌ Syntax error in ${filePath}:\n${err}`));
                    errorFiles++;
                } else {
                    okFiles++;
                }
            } catch (e) {
                console.error(chalk.yellow(`⚠️ Cannot read file ${filePath}:\n${e}`));
                errorFiles++;
            }
        });
});

/**
* console.log(chalk.greenBright(`✅ OK files: ${okFiles}`));
* console.log(chalk.redBright(`❌Files with errors: ${errorFiles}\n`));
*/

process.on('uncaughtException', (err) => {
    printLog('error', `Uncaught Exception: ${err.message}`);
    console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
    printLog('error', `Unhandled Rejection: ${err.message}`);
    console.error(err.stack);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        printLog('error', `Address localhost:${PORT} in use`);
        server.close();
    } else {
        printLog('error', `Server error: ${error.message}`);
    }
});

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    printLog('info', 'index.js updated, reloading...');
    delete require.cache[file];
    require(file);
});


