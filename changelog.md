# Changelog

All notable changes to the PGWIZ-MD multi-device WhatsApp bot project are documented in this file.

## [4.3.0] - 2026-09-17

### Added
- **Mistral Conversational AI Mode (`.aimode`, `.chatbot`)**:
  - Integrated with `https://mistral-conversational.vercel.app/api/chat` using Mistral AI models (`ministral-8b-2512`).
  - Supports 8 persona modes: `gen-co`, `gen-co-em`, `prof-tech`, `socratic`, `eli5`, `concise`, `code-mentor`, `creative`.
  - Supports 5 depth levels: from Level 1 (Ultra-Brief) to Level 5 (Masterclass).
  - Multi-turn bounded conversation memory with automatic pruning.
  - **Private Direct Messages**:
    - Automatic response to incoming text without requiring direct mention or reply.
    - Incoming media (photos, videos, stickers, voice notes, documents) triggers a humorous roast/playful response with custom witty system prompts.
    - Persona mode and depth levels fully configurable via aliases (`.aimode eli5`, `.aimode code`, `.aimode tech`, `.aimode level 1`, etc.).
  - **Group Chats**:
    - Strictly restricted to Conversational Mode (`gen-co`).
    - Responds ONLY when the bot is explicitly mentioned (`mentionedJid`) or replied to (`quotedMessage`).
    - Configurable only by group admins or bot owner/sudo.
  - **Safeguards**:
    - Self-messages (`fromMe: true`) strictly ignored to prevent reply loops.
    - Command-prefixed messages (`usedPrefix`) bypassed.
    - 35s timeout and graceful connection failure handling with polite user feedback.

## [4.2.0] - 2026-09-16

### Added
- **Controller Web Panel (`/panel`)**: Glassmorphic multi-device control interface gated by environment variables (`ENABLE_WEB_PANEL=true` or authenticated via master `DEBUG_KEY`/`PANEL_PASSWORD`). Supports bot mode switching (`public`, `private`, `groups`, `inbox`), live AutoStatus toggle and strategy selection (strategies 1–12), direct WhatsApp message dispatching, hot plugin reloading (`reload_plugins`), and live log streaming.
- **Multi-Model AI Chat Suite (`.ai`)**: Comprehensive multi-turn conversation memory with support for `.ai`, `.gpt`, `.gemini`, `.deepseek`, `.claude`, `.copilot`. Uses high-speed free Pollinations AI provider with automatic fallbacks and conversation turn reset (`.ai reset`).
- **High-Speed Direct APK Downloader (`.apk`, `.app`, `.getapk`)**: Official Aptoide REST API integration for searching and downloading Android APK packages directly to WhatsApp up to 80MB.
- **URL Shortener (`.shorten`, `.short`, `.tinyurl`, `.isgd`)**: Multi-provider URL shortening engine using TinyURL, is.gd, and CleanURI.
- **Voice Text-to-Speech Engine (`.tts`, `.say`, `.speak`)**: Direct Google Translate TTS audio streamer delivering voice notes (`ptt: true`) with multi-language support.
- **AI Image Generation (`.imagine`, `.draw`, `.flux`)**: High-resolution image generation powered by Flux / Pollinations AI with automatic prompt enhancement.
- **URL Inspector & Expander (`.unshorten`, `.expand`, `.trace`)**: Real-time link redirect tracer.
- **QR Code Reader (`.readqr`, `.qrread`)**: Scans QR codes from image attachments using free QRServer API.

### Changed & Optimized
- **Lowest-Quality Ultra-Fast Audio Streaming**: Updated `.play` and `.song` to default to `saver` quality (64k Data Saver) from `https://ytsp-api.pgwiz.cloud/`, saving 70%+ bandwidth and delivering instantaneous streaming playback.
- **Video Downloader (`.video`)**: Defaults to 360p stream for minimal data usage and rapid uploads, with optional `hd`/`720p` parameter.
- **Consolidated Redundant Plugins & Dualities**:
  - Removed duplicate `a-ytmp4.js` in favor of unified `video.js`.
  - Consolidated `gitclone2.js` into enhanced `gitclone.js` with GitHub zipball streaming.
  - Renamed `a-clean.js` to `wipe.js` to eliminate alias collision with `clear.js`.
  - Consolidated `removeplugin.js` into `delplugin.js` with core system plugin protection and commandHandler reload.
  - Consolidated `developer.js` into `owner.js` with rich platform, bot version, and GitHub info.
  - Consolidated `updateforce.js` into `update.js` supporting `--force` / `.updateforce` and removed colliding `reload`/`hotreload` aliases.
- **MediaFire Downloader (`.mediafire`)**: Fixed missing top-level `axios` variable and added 80MB upload safeguard.
- **Facebook Downloader (`.fb`)**: Integrated multi-engine fallbacks (Gifted, GuruAPI, GTech) with ascending quality sorting for fast SD delivery.
- **Instagram Downloader (`.instagram`)**: Added GuruAPI fallback and improved error handling for Reels and posts.
- **Command Context Architecture**: Updated `messageHandler.js` and `messageHandler_raw.js` to compute `invokedCmd` and pass `command`, `invokedCmd`, and `usedPrefix` inside `context`.
