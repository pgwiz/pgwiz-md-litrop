# 📖 PGWIZ-MD Documentation & Wiki

Welcome to the official **PGWIZ-MD** (and **pgwiz-md-litrop**) Wiki. PGWIZ-MD is a lightning-fast, multi-device WhatsApp automation suite engineered for high availability, cloud deployments (Heroku, Koyeb, Render, VPS, Termux), and dynamic runtime environment configuration.

---

## ⚡ Quick Navigation

* [📱 Session Pairing & QR Scanner](Session-Scanner) — Pair WhatsApp and generate SESSION_ID.
* [⚙️ Configuration Guide](Configuration) — Environment variables, Heroku/Koyeb auto-auth, and database setups.
* [🛠️ Dynamic Environment Manager](Environment-Manager) — Live `.pgvars`, `.heroku`, and `.koyeb` management.
* [⚡ Automation & Presence Engine](Automation) — Auto-status, reaction rhythms, contact ignore lists, and 24/7 always-online.
* [🛡️ Group Moderation & Administration](Admin-Commands) — Moderation, tagging, warnings, bans, and chat clearing.
* [📥 Downloaders & Media](Downloaders) — YouTube, TikTok, Instagram, Facebook, Spotify, and APK downloaders.
* [🚀 Deployment Guide](Deployment) — 1-click deployments to Heroku, Koyeb, Render, VPS, and Termux.
* [❓ Frequently Asked Questions](FAQ) — Troubleshooting, session pairing, and optimization tips.

---

## 🌟 Key Highlights

* **🔥 First-Class Boot Auto-Detection**: Instant `process.env` loading for `AUTO_STATUS_VIEW`, `AUTO_STATUS_REACT`, `STATUS_EMOJIS`, `ALWAYS_ONLINE`, and `MODE`.
* **☁️ Cloud Platform Dynamic Syncing**: Manage Heroku and Koyeb config vars directly inside WhatsApp using `.pgvars`.
* **👀 Clean Auto-Status Engine**: 120s age guard, persistent SQLite deduplication, per-contact ignore list, and custom multi-emoji reaction rhythm.
* **📱 Native Notification Guard**: When `ALWAYS_ONLINE=false`, background presence is kept offline so mobile push notifications arrive uninterrupted.
* **🧹 Non-Destructive Chat Clearing**: `.clear` and `.autoclear` wipe message bubbles while keeping your chats in your inbox.
