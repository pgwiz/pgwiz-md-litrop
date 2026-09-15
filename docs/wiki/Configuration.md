# ⚙️ Environment Configuration Guide

Configure your bot using environment variables in your cloud dashboard (Heroku, Koyeb, Render, Docker) or in a local `.env` file.

---

## 🔑 1. Authentication & Session

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `SESSION_ID` | **String** | *Required* | Authentication session string from pairing scanner | `pgwiz_PGWIZ-MD_xxxx...` |
| `PAIRING_NUMBER` | **String** | `""` | Phone number without `+` for terminal pairing code | `254718252555` |
| `FORCE_SESSION_RESET` | **Boolean** | `false` | Wipe local session files on boot (recovery only) | `false` |

---

## 🗄️ 2. Database & Server

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `PORT` | **Number** | `5000` | HTTP server port for cloud health checks (`/healthz`, `/ping`) | `5000` |
| `DB_URL` | **String** | `"./baileys_store.db"` | Database backend connection string or file path | `./baileys_store.db` |
| `MONGO_URL` | **String** | `""` | Optional MongoDB connection URL for persistent cloud storage | `mongodb+srv://...` |
| `POSTGRES_URL` | **String** | `""` | Optional PostgreSQL connection URL | `postgresql://...` |
| `MYSQL_URL` | **String** | `""` | Optional MySQL connection URL | `mysql://...` |

---

## 🌐 3. Regional & Bot Identity

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `TIMEZONE` / `TZ` | **String** | `"Africa/Nairobi"` | Global bot timezone for logs, status clocks, and dates | `Africa/Nairobi` |
| `BOT_NAME` | **String** | `"PGWIZ-MD"` | Bot display name on menus and captions | `PGWIZ-MD` |
| `BOT_OWNER` | **String** | `"pgwiz"` | Owner display name | `pgwiz` |
| `PREFIX` | **String** | `"."` | Primary command prefix | `.` |
| `OWNER_NUMBER` | **String** | `""` | Comma-separated list of owner numbers with country code | `254718252555,254789462334` |
| `SUDO_USERS` | **String** | `""` | Comma-separated phone numbers with elevated privileges | `254718252555,62561080893516` |

---

## 🤖 4. Automations & Feature Flags

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `MODE` / `WORK_TYPE` | **String** | `"public"` | Access mode: `public`, `private`, `groups`, `inbox` | `public` |
| `AUTO_STATUS_VIEW` | **Boolean** | `true` | Automatically mark contact statuses as viewed | `true` |
| `AUTO_STATUS_REACT` | **Boolean** | `true` | Automatically react to contact statuses with emojis | `true` |
| `STATUS_EMOJIS` | **String** | `"💯,❤️,🔥,✨,🌟,⚡"` | Comma-separated emojis for auto status reactions | `"💯,🔥,⚡,✨"` |
| `AUTOSTATUS_IGNORE` | **String** | `""` | Comma-separated contact numbers to skip from status view/react | `254712345678,254798765432` |
| `AUTOREAD` | **Boolean** | `false` | Automatically mark incoming chat messages as read (blue ticks) | `false` |
| `AUTOTYPING` | **Boolean** | `false` | Simulate typing indicator when executing commands | `false` |
| `AUTOREACT` | **Boolean** | `false` | Automatically react to incoming messages with emojis | `false` |
| `ANTICALL` | **Boolean** | `false` | Automatically decline and reject incoming WhatsApp calls | `false` |
| `ANTIDELETE` | **Boolean** | `false` | Automatically resend deleted messages to owner or group | `false` |
| `ALWAYS_ONLINE` | **Boolean** | `false` | 24/7 online presence broadcast (set `false` for battery/notifications) | `false` |
| `PRESENCE_MODE` | **String** | `"available"` | Default presence: `available`, `unavailable`, `composing`, `recording` | `available` |
| `AUTO_PRESENCE` | **String** | `"off"` | Presence during message handling: `off`, `typing`, `recording`, `online` | `off` |
| `DISABLED_GROUPS` | **String** | `""` | Comma-separated list of group JIDs/IDs where bot is disabled | `120363306092749988,120363123456789` |

---

## ☁️ 5. Cloud Platform Sync & API Keys (Optional)

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `HEROKU_API_KEY` / `HKEY` | **String** | `""` | Heroku API Token for dynamic in-chat `.pgvars` sync | `HRKU-xxxx-xxxx` |
| `HEROKU_APP_NAME` / `HAPP` | **String** | `""` | Heroku App Name | `my-pgwiz-bot` |
| `KOYEB_API_TOKEN` / `K_TOKEN` | **String** | `""` | Koyeb API Token for dynamic in-chat `.pgvars` sync | `koyeb_api_tok_xxxx` |
| `KOYEB_SERVICE_NAME` / `K_APP` | **String** | `""` | Koyeb Service / App Name | `pgwiz-service` |
| `REMOVEBG_KEY` | **String** | `""` | API Key from remove.bg for HD background removal | `xxxx-xxxx` |
| `GIPHY_API_KEY` | **String** | Provided | API Key for Giphy GIF search commands | `qnl7ssQChTdPjsKta2Ax2LMaGXz303tq` |
