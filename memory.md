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
* **Presence Pulse vs Protocol Keepalives**: WhatsApp servers disconnect or rate-limit companion WebSockets (codes 428 / 515 / 440) if application-level presence (`<presence type="available"/>`) is flooded frequently (e.g. 8s). Companion socket keepalives are handled at the protocol frame level via `keepAliveIntervalMs: 10000`. A gentle 60s pulse strictly guarded by `sock.ws.readyState === 1` preserves always-online state safely.
* **Interval Lifecycle on Disconnect**: Leaked intervals hammering closed WebSockets prevent clean TCP teardown and flood error streams. Timers (`alwaysOnlineInterval`, `presenceHeartbeatInterval`) must be explicitly cleared in the `connection === 'close'` handler.
* **Session Directory Key Protection**: Indiscriminate unlinking in `./session` destroys active cryptographic Signal ratchet keys. `pre-key-*`, `session-*`, `sender-key-*`, and `app-state-sync-key-*` must NEVER be deleted while the session is alive; doing so results in fatal "Bad MAC" and private key desynchronization errors.
* **Fast Reconnect on Code 515**: Disconnect reason 515 (`restartRequired`) should initiate an immediate 2-second reconnect backoff instead of standard long delays.

---

### 🤖 Conversational AI Mode & Reply-to-All (`repal` / `repan`):
* **Group Persona Customization**: Group chats support any of the 10 AI persona modes (`gen-co`, `gen-co-em`, `prof-tech`, `socratic`, `eli5`, `concise`, `code-mentor`, `creative`, `zen`, `medieval`) and 5 depth levels (1-5).
* **Reply-to-All Controls**:
  - `repal` (`replyAll: true`): Bot replies to all messages in the group without requiring @mentions or quote replies.
  - `repan` (`replyAll: false`): Standard mode requiring direct @mention or quote reply.
  - Flexible invocation: `.aimode <mode> <level> repal`, `.aimode repal`, `.aimode repan`, or dedicated shortcuts `.repal` and `.repan`.
* **Security & Authorization**: Group configuration changes are strictly restricted to group admins and bot owner/sudo.

