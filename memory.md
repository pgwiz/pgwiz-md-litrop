# Project Memory & Technical Backlog

## 📌 Downloader Modernization & API Replacement Backlog

The following downloaders were audited and flagged as currently non-functional due to external third-party API outages, dead domains, or HTTP 503/402 errors. They are queued for replacement with high-speed, reliable alternative endpoints:

---

### 🔴 High-Priority Downloaders to Fix:

1. **Instagram Downloader (`.instagram` / `.ig`)**
   - **Target File**: `plugins/instagram.js`
   - **Issue**: `api.giftedtech.web.id` is unreachable (`ENOTFOUND` domain dead).
   - **Planned Fix**: Integrate Instagram Scraper/API (e.g. SnapInsta API, FastDL API, or direct GraphQL metadata scraper).

2. **Twitter / X Video Downloader (`.twitter` / `.x` / `.xdl`)**
   - **Target File**: `plugins/twitter.js`
   - **Issue**: Hardcoded to `discardapi.dpdns.org` (`HTTP 503 Service Unavailable`).
   - **Planned Fix**: Integrate Twitsave / Twitter APIv2 / direct CDN syndication parser.


4. **SoundCloud Downloader (`.scloud` / `.soundcloud`)**
   - **Target File**: `plugins/scloud.js`
   - **Issue**: `discardapi.dpdns.org` returns `HTTP 503`.
   - **Planned Fix**: Integrate direct SoundCloud v2 API / client_id resolver or alternative streaming endpoints.

6. **APK Downloaders (`.apkmirror` / `.apkpure`)**
   - **Target File**: `plugins/apkmirror.js`, `plugins/apkpure.js`
   - **Issue**: `discardapi.dpdns.org` returns `HTTP 503`.
   - **Planned Fix**: Direct APKPure / APKMirror / Aptoide web scraper or Google Play scraper.

7. **Google Image Search (`.gimage` / `.image`)**
   - **Target File**: `plugins/gimage.js`
   - **Issue**: `discardapi.dpdns.org` returns `HTTP 503`.
   - **Planned Fix**: Integrate Google Custom Search API, Unsplash API, or DuckDuckGo Image scraper.

8. **Snapchat Video Downloader (`.snapchat`)**
   - **Target File**: `plugins/snapchat.js`
   - **Issue**: `discardapi.dpdns.org` returns `HTTP 503`.
   - **Planned Fix**: Integrate SnapStory / Spotlight video resolver.

9. **Stock Media & Video Downloaders (`.alamy`, `.getty`, `.istock`, `.vidsplay`, `.sharechat`, `.snack`)**
   - **Target Files**: `plugins/alamy.js`, `plugins/getty.js`, `plugins/istock.js`, `plugins/vidsplay.js`, `plugins/sharechat.js`, `plugins/snackvideo.js`
   - **Issue**: Hardcoded to dead `discardapi.dpdns.org` (`HTTP 503`).
   - **Planned Fix**: Replace with working stock scrapers or consolidate into a single universal media command.

---

### 🟢 Fully Functional & Verified Downloaders:
* **`.lyrics` / `.lyric` / `.songlyrics`**: Multi-provider high-speed lyrics engine (LRCLIB + iTunes 600x600 HD artwork + Lyrics.ovh fallback).
* **`.spotify` / `.sp` / `.spotifydl`**: Powered by `https://ytsp-api.pgwiz.cloud` with 100% keyless Spotify metadata embed extraction, YouTube audio stream bridge, playlist/album tracklist overview, and dual playable voice audio + downloadable MP3 document.
* **`.song` / `.mp3`**: Powered by `https://ytsp-api.pgwiz.cloud` (Dual playable audio + MP3 document, seamless YouTube & Spotify link detection).
* **`.play` / `.music`**: Instant YouTube and Spotify audio player via `https://ytsp-api.pgwiz.cloud`.
* **`.video` / `.ytmp4`**: High-speed YouTube video downloader (360p & 720p HD).
* **`.tiktok` / `.tt`**: Multi-Engine HD TikTok downloader (`TikWM` + `SaveTik.co` + `MusicalDown` scrapers with canonical unshortener, No Watermark, Photo Slideshows, and MP3 audio extraction).
* **`.mediafire`**: Direct Cheerio HTML stream parser.
* **`.gitclone` / `.gitclone2`**: Official GitHub Repository zipball downloader.
* **`.facebook` / `.fb`**: `gtech-api-xtp1.onrender.com` video extractor.
* **`.statusdl`**: Native Baileys WhatsApp status decryptor.

---

### ⚡ Smart Auto-Reaction Engine:
* Integrated into `lib/reactions.js`, `lib/messageHandler.js`, and `plugins/areact.js`.
* Automatically classifies incoming message sentiments (Laughter, Love, Greetings, Thanks, Fire/Celebration, Questions, Sympathy, Agreement, Surprise, Music, Faith) to react with the most suitable emojis.
* Controlled via `.autoreact on/off/dm/group/status` and persistent across reboot via `store.getSetting('global', 'autoReact')` and `.pgvars AUTO_REACT`.

---

### 👁️ WhatsApp Multi-Device Auto Status View & Reaction Architecture:
* **Status Views**: WhatsApp Multi-Device has no separate "view" API. Sending an explicit `type: 'read'` receipt (`sock.sendReceipt('status@broadcast', normParticipant, [key.id], 'read')` alongside `sock.readMessages([msg.key])`) is what adds the bot to the author's viewer list.
* **Never Send `read-self`**: `read-self` tells WhatsApp servers to keep the read private to the user's companion devices and explicitly suppresses notifying the status author.
* **Status Reaction**: Multi-Device status reactions require `sock.sendMessage('status@broadcast', { react: { text: emoji, key: reactionKey } }, { statusJidList })` alongside `sock.relayMessage(...)`.
* **LID (Linked Identity) & Phone Number Support**: `reactionKey.participant` must preserve the raw author JID (especially `@lid` accounts), and `statusJidList` must include both raw and normalized participant JIDs (excluding `'status@broadcast'`).
* **Privacy Prerequisite**: The status author MUST have the bot's phone number saved in their contacts, otherwise WhatsApp servers never fan out the status stanza to the bot.
* **Environment-Driven Emojis**:
  - `AUTO_STATUS_EMOJIS` / `STATUS_EMOJIS`: Flexible pool (comma-separated, space-separated, JSON array, or grapheme clusters). Supports flags (`🇺🇸`), keycaps (`1️⃣`), skin tones, and ZWJ sequences.
  - `AUTO_STATUS_REACTION` / `STATUS_REACTION`: Fixed single reaction emoji, or `"random"` to randomize across pool. Takes priority over database/file fallbacks.
  - `AUTO_REACT_EMOJIS`: Custom fallback list for smart message auto-reactions.
  - `CMD_REACT_EMOJI` / `COMMAND_REACT_EMOJI`: Emoji used for bot command execution reaction.
  - Runtime management supported via `.pgvars` and `.autostatus reaction <emoji|random|list>`.

---

### 🛡️ WhatsApp Socket & Connection Stability Principles:
* **Presence Pulse vs Protocol Keepalives**: WhatsApp servers disconnect or rate-limit companion WebSockets (codes 428 / 515 / 440) if application-level presence (`<presence type="available"/>`) is flooded frequently. Companion socket keepalives are handled at the protocol frame level via `keepAliveIntervalMs: 10000`. A single unified 90s unref'd pulse strictly guarded by `sock.ws.readyState === 1` and managed by `plugins/alwaysonline.js` preserves always-online state safely without double-pulse collision.
* **Non-Presence `sendNode` Preservation**: Never block non-presence stanzas in `sendNode` based on `readyState`. Dropping IQ queries, messages, or handshakes corrupts Baileys internal query state machine and causes hung promises.
* **Clean Socket Teardown**: On `connection === 'close'`, the old WebSocket must be explicitly terminated (`ws.removeAllListeners(); ws.close();`) before a new connection is spawned, preventing status 440 ("Another bot instance is currently connected").
* **401 Session Auto-Recovery**: On 401 (`DisconnectReason.loggedOut`), the bot must not terminate or become a dead zombie. If `SESSION_ID` is present in the environment, it re-downloads fresh credentials and reconnects automatically.
* **Session Directory Key Protection**: Indiscriminate unlinking in `./session` destroys active cryptographic Signal ratchet keys. `pre-key-*`, `session-*`, `sender-key-*`, `sender-key-memory-*`, `app-state-sync-key-*`, and `app-state-sync-version-*` must NEVER be deleted; only `.tmp` and `.bak` files are pruned.
* **Hosting OOM Self-Restart**: A graceful threshold at 450MB RSS flushes store state and executes `process.exit(1)`, enabling PM2, Docker, Koyeb, or Render to reboot the container cleanly before the OS kernel terminates it with an uncatchable `SIGKILL` (-9).
* **Fast Reconnect on Code 515**: Disconnect reason 515 (`restartRequired`) initiates an immediate 2-second reconnect backoff instead of standard long delays.

---

### 🤖 Conversational AI Mode & Reply-to-All (`repal` / `repan`):
* **Group Persona Customization**: Group chats support any of the 10 AI persona modes (`gen-co`, `gen-co-em`, `prof-tech`, `socratic`, `eli5`, `concise`, `code-mentor`, `creative`, `zen`, `medieval`) and 5 depth levels (1-5).
* **Reply-to-All Controls**:
  - `repal` (`replyAll: true`): Bot replies to all messages in the group without requiring @mentions or quote replies.
  - `repan` (`replyAll: false`): Standard mode requiring direct @mention or quote reply.
  - Flexible invocation: `.aimode <mode> <level> repal`, `.aimode repal`, `.aimode repan`, or dedicated shortcuts `.repal` and `.repan`.
* **Security & Authorization**: Group configuration changes are strictly restricted to group admins and bot owner/sudo.

---

### 💬 Keith MD Rich AI-Response Messages & Interactive Buttons Engine:
* **Architecture & Strategy**:
  - Instead of replacing `@whiskeysockets/baileys` with external packages, all Keith MD rich response and native flow primitives are implemented natively in `lib/richMessages.js` and `lib/customBaileys.js`.
  - Retains 100% stability with SQLite stores, libsignal encryption, and credentials while matching Keith MD capabilities.
* **Why Rich Messages Arrived Blank (Root Cause & Fix)**:
  - In WhatsApp's `botForwardedMessage` protocol, clients render content strictly from the `submessages` array inside `richResponseMessage`.
  - Previous implementations had empty/hardcoded `submessages: []` and lacked `messageContextInfo.botMetadata.verificationMetadata.proofs`.
  - The ported engine populates real submessages (types 2=text, 3=inline image, 4=table, 5=code, 8=latex) with cryptographic proofs.
* **Why Native Flow Buttons Failed ("Did Nothing")**:
  - `patchMessageBeforeSending` in `index_raw.js` was wrapping `interactiveMessage` in `viewOnceMessage` with `deviceListMetadataVersion: 2`. Modern WhatsApp clients silently ignore or drop interactive messages wrapped in view-once.
  - Fix: Passed messages through cleanly (`patchMessageBeforeSending: msg => msg`) and used Keith's direct `{ interactiveMessage }` payload with `messageParamsJson: ''` and `<biz>` stanza nodes.
* **Elimination of Meta AI Header Badge on Buttons**:
  - Native flow buttons in DMs previously had `<bot biz_bot="1"/>` appended to `additionalNodes`, which instructed WhatsApp clients to display an "AI" / "Meta AI" badge.
  - Removing `<bot biz_bot="1"/>` from `getButtonAdditionalNodes()` in `lib/customBaileys.js` allows buttons 1-5 & 7 to render cleanly without the AI badge, exactly matching ButtonV2 (Button 6).
* **Clean Button Engine (`ButtonV2` & `sock.sendButtonV2`)**:
  - Delivers clean message content and interactive buttons without dummy location cards (`headerType: 6` with `degreesLatitude: 0`) or AI tags.
  - Retains optional location card support for users who explicitly request map cards (`.testbtn 6 loc` or `options.location: true`).
* **Test Suite**:
  - 14 test cases in `plugins/testbutton.js` (`.testbtn 1-14` / `.testrich 1-7`).

---

### ⏱️ Connection Disconnects: 50-Minute Cycles (Stream Errored ack 500) & Passive IQ 408 Timeouts:
* **Periodic 50-Minute Disconnect Pattern (`Status: 500 Stream Errored (ack)`)**:
  - **Symptom**: Disconnection occurs exactly every ~50 minutes (3,000 seconds: 12:41, 13:31, 14:21, 15:11...).
  - **Root Cause**: WhatsApp companion WebSockets negotiate stream tokens with a ~50-minute TTL. During token refresh, if active keepalive timers fire aggressive application-level pings or presence updates concurrently, an ack mismatch occurs and WhatsApp drops the stream with error 500.
  - **Fix Mechanics**:
    1. Deadman Watchdog Keepalive: Keepalive is strictly passive. Pings are only sent if the socket has been completely silent for >45 seconds (`silenceMs > 45000`), ending ping collisions.
    2. Reconnect Backoff: Disconnects with status 500 automatically reconnect within 2-5 seconds without wiping credentials or Signal pre-keys.
* **Passive IQ 408 Timeout (`sendPassiveIq` Timed Out)**:
  - **Symptom**: `Error: Timed Out` (Status 408) occurring at `sendPassiveIq` -> `query` -> `waitForMessage` -> `promiseTimeout`.
  - **Root Cause**: On login (`CB:success`), Baileys fires `sendPassiveIq('active')` to notify the server that the companion device is active. Under network congestion or cloud container latency, WhatsApp servers occasionally delay or omit the IQ ack, exceeding `defaultQueryTimeoutMs`. This threw an unhandled promise rejection that crashed the bot.
  - **Fix Mechanics**:
    1. Intercepted `sock.query` in `customBaileys.js` and `index_raw.js` to absorb passive IQ and ping 408 timeouts (`return undefined`), preventing rejection propagation.
    2. Filtered out benign 408 rejections in `process.on('unhandledRejection')` across `index_raw.js` and `lightweight_store.js`.

---

### 🛡️ Autostatus Human Delay & Account Anti-Ban Protection:
* **The Problem**: Instant viewing (0ms) and reacting (300ms) upon receipt of `status@broadcast` is an unnatural bot signature flagged by WhatsApp's behavioral heuristics. Additionally, if the author posted a status with a typo and immediately deleted it within 1–2 seconds, the bot reacted before the revoke stanza was processed, exposing bot automation.
* **The Solution**:
  1. **Randomized Human Jitter (3.5s – 8.0s total)**:
     - View delay: 2.0s – 4.5s (`AUTO_STATUS_VIEW_DELAY_MIN` to `AUTO_STATUS_VIEW_DELAY_MAX`). Emulates the user seeing the notification and opening the status.
     - Reaction delay: 1.5s – 3.5s (`AUTO_STATUS_REACT_DELAY_MIN` to `AUTO_STATUS_REACT_DELAY_MAX`). Emulates viewing the status media and tapping an emoji reaction.
  2. **Revocation Abort Guard**:
     - Status revocation events populate `revokedStatusIds`.
     - During the delay intervals, if `revokedStatusIds.has(key.id)` is detected, processing aborts immediately. The bot never marks deleted statuses as viewed or reacts to them.

---

### 📢 Channel Forwarding Removal & Native Flow "Open Channel" Button Architecture:
* **The Problem**: Prepending `forwardedNewsletterMessageInfo: { newsletterJid, newsletterName }` with `isForwarded: true` displayed an intrusive "Forwarded from channel" header bar on every bot response, confusing users and adding clutter.
* **The Solution**:
  1. **Purged Channel Forwarding**:
     - Stripped `forwardedNewsletterMessageInfo`, `isForwarded`, and `forwardingScore` across all plugins, `lib/messageConfig.js`, and `lib/messageHandler_raw.js`.
     - Added automatic sanitization in `sock.sendMessage` interceptor to delete any residual forwarded channel badges from message `contextInfo`.
  2. **Option 4 Native Flow "📢 Open Channel" URL Button**:
     - Centralized in `lib/messageConfig.js`: exported `channelButton = { type: 'url', text: '📢 Open Channel', url: settings.channelLink }` and `channelInfo = { buttons: [channelButton] }`.
     - In `lib/customBaileys.js`: `sock.sendMessage` intercepts text command messages and automatically renders a sleek Native Flow interactive button bar linking directly to the official WhatsApp channel.
  3. **Media Corruption Guard**:
     - Direct media (audio voice notes, stickers, reactions, PTV) strictly bypass button attachment so that WhatsApp binary media frames are never corrupted into invalid payloads.

---

### 🎵 TikTok Downloader Multi-Engine Pipeline & Direct URL Streaming:
* **The Problem**: Reliance on single scrapers (SaveTik, MusicalDown) led to frequent failures when providers altered DOM markup or blocked datacenter IPs. Furthermore, buffering 20MB+ video files directly in container memory triggered high-RAM alerts and download timeouts.
* **The Solution**:
  1. **Multi-Engine Redundancy**:
     - **Engine 1**: TikWM REST API (`https://www.tikwm.com/api/?url=...&hd=1`).
     - **Engine 2**: SSSTik Scraper (`https://ssstik.io/abc?url=dl`) parsing unwatermarked `tikcdn.io` stream links.
     - **Engine 3**: TikWM POST fallback with automated retry.
  2. **Canonical URL Resolution**:
     - Resolves shortened redirects (`vm.tiktok.com`, `vt.tiktok.com`, `/t/`) and strips tracking parameters prior to querying engines.
  3. **Direct URL Stream Delivery**:
     - Directly sends `{ video: { url: data.videoUrl }, caption, ...channelInfo }`, allowing WhatsApp's edge infrastructure to fetch the video stream instantaneously with zero container memory overhead.
     - Automatically falls back to arraybuffer download if direct streaming is rejected by WhatsApp servers.


---

### 🛠️ Core Redundancy Reducer & Convenience Utilities (`sock`, `global`, `context`, `message`):
* **The Problem**: Over 100 plugins repeatedly re-implemented duplicate boilerplate:
  - 54 plugins manually extracted quoted message captions and stanzas.
  - 73 plugins manually wrapped `{ image: ... }` / `{ video: ... }` structures with channel metadata.
  - 25 plugins constructed manual `{ react: { text, key } }` payloads.
  - 24 plugins used manual `axios.get(url, { responseType: 'arraybuffer' })`.
* **The Solution**:
  1. **Global Utilities**:
     - `global.getBuffer(url, options)`: Standardized high-reliability buffer fetcher with timeout and modern browser User-Agent headers.
     - `global.parseQuoted(message)`: Universal context/quoted extractor returning `{ isQuoted, text, sender, type, stanzaId, message, contextInfo }`.
  2. **Socket Methods** (`patchBaileysSocket` in `lib/customBaileys.js`):
     - `sock.reply(chatId, text, quoted, options)`
     - `sock.react(targetMessageOrKey, emoji)`
     - `sock.sendImage(chatId, bufferOrUrl, caption, quoted, options)`
     - `sock.sendVideo(chatId, bufferOrUrl, caption, quoted, options)`
     - `sock.sendAudio(chatId, bufferOrUrl, ptt, quoted, options)`
     - `sock.sendSticker(chatId, buffer, quoted, options)`
     - `sock.getBuffer(url, options)`
     - `sock.downloadMedia(messageOrQuoted)`
     - `sock.parseQuoted(message)`
     - `sock.isOwner(jid)`
  3. **Context & Message Shortcuts**:
     - Decorated in `lib/messageHandler.js`: `message.reply`, `message.react`, `context.reply`, `context.react`, `context.getBuffer`, `context.downloadMedia`, `context.parseQuoted`.
