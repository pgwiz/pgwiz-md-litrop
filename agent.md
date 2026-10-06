# Agent Guide: PGWIZ-MD / MEGA-MD Architecture & Operating Manual

## 1. Executive Overview
PGWIZ-MD (and its lightweight sibling `pgwiz-md-litrop` / `mega-light`) is a production multi-device WhatsApp bot built on Node.js and `@whiskeysockets/baileys`. It features SQLite-persisted multi-file auth credentials, automated status viewing and emoji reactions, conversational AI modes (Mistral/OpenAI persona proxies), native flow and classic button builders, and a complete Keith MD rich AI-response engine.

---

## 2. Inviolable Architectural Rules
1. **Markdown Discipline**: NEVER create arbitrary or proliferating markdown files. The ONLY permitted `.md` files in this repository are:
   - `readme.md` (Public showcase and user documentation)
   - `changelog.md` (Chronological release notes)
   - `memory.md` (Durable architectural invariants, root cause analysis, ADRs)
   - `agent.md` (This file: master agent guide and operations manual)
2. **Dual-Repo 100% Parity**: All changes made to `mega-main` MUST be strictly mirrored to `mega-light` (`pgwiz-md-litrop`).
3. **Build Pipeline**: 
   - Runtime files `index.js` and `lib/messageHandler.js` are generated from `index_raw.js` and `lib/messageHandler_raw.js`.
   - Never edit `index.js` or `lib/messageHandler.js` directly. Always edit the `_raw.js` sources and execute `node build.js`.
4. **History Sync Guard**: In `index_raw.js`, NEVER enable full history sync:
   - `shouldSyncHistoryMessage: () => false` must remain untouched to prevent memory exhaustion, slow boot times, and Signal session desync on cloud hosts.
5. **Syntax Verification**: Always test every touched file with `node -c` or `vm.Script` before committing.

---

## 3. Core Directory & Topology Map
* **`index_raw.js`** $\rightarrow$ `index.js`: Socket initialization (`makeWASocket`), connection lifecycle handler, auth state loader, process watchdog, and event routing.
* **`lib/messageHandler_raw.js`** $\rightarrow$ `lib/messageHandler.js`: Core message dispatcher, command prefix resolver, anti-spam/rate limits, group vs DM authorization, and status routing.
* **`lib/customBaileys.js`**: Native Baileys extension layer:
  - Keith MD Rich Messages: `sendTable`, `sendList`, `sendCodeBlock`, `sendLink`, `sendLatex`, `sendRichMessage`, `sendUnifiedResponse`.
  - Buttons: `sendButtons` (Native Flow), `sendButtonV2` (Classic `buttonsMessage`), and `sock.btn` builders.
  - Socket Stability: Passive deadman keepalive watchdog (`silenceMs > 45000`), pre-key maintenance, session self-healing (`sock.healSession`), and tiered `sock.getMessage`.
* **`lib/richMessages.js`**: Meta AI-style rich message builder ported from Keith Baileys with real submessage serialization and cryptographic verification metadata envelopes.
* **`lib/sqliteAuthState.js`**: High-performance SQLite backing for multi-file auth credentials and Signal ratchet keys.
* **`lib/lightweight_store.js`**: In-memory and SQLite-backed message store, chat metadata cache, and configuration persistence (`store.getSetting` / `store.saveSetting`).
* **`plugins/`**: Modular command plugins:
  - `autostatus.js`: WhatsApp status auto-view and auto-reaction engine.
  - `chatbot.js` / `aimode.js`: Conversational AI multi-persona mode with group Reply-to-All (`repal`/`repan`).
  - `testbutton.js`: 14 interactive test cases (`.testbtn 1-14` / `.testrich 1-7`).
  - `alive.js`, `ping.js`, `alwaysonline.js`, `pgvars.js`, `downloaders`, etc.
* **`build.js`**: Build automation script copying `index_raw.js` $\rightarrow$ `index.js` and `lib/messageHandler_raw.js` $\rightarrow$ `lib/messageHandler.js`.

---

## 4. Operational Runbook & Common Workflows

### Compiling and Validating:
```bash
node build.js
node -c index.js
node -c lib/customBaileys.js
node -c lib/richMessages.js
node -c lib/messageHandler.js
```

### Git Release Pipeline:
```bash
# In mega-main:
git add -A && git commit -m "feat/fix: description"
git push origin main
git push wiptech main

# In mega-light:
git add -A && git commit -m "feat/fix: description"
git push origin main
```

### Health Monitoring:
* Health Endpoint: `GET https://drunk-cati-wiptechgx-d794d1cd.koyeb.app/healthz`
