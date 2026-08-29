# ⚙️ Environment Configuration Guide

Configure your bot using environment variables in your cloud dashboard (Heroku, Koyeb, Render) or in a local `.env` file.

---

## 🔑 Essential Environment Variables

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `SESSION_ID` | **String** | *Required* | Authentication session string from pairing scanner | `pgwiz_PGWIZ-MD_xxxx...` |
| `OWNER_NUMBER` | **String** | `""` | Comma-separated list of owner numbers | `254718252555,254700000000` |
| `BOT_NAME` | **String** | `"PGWIZ-MD"` | Bot display name | `PGWIZ-MD` |
| `MODE` / `WORK_TYPE` | **String** | `"public"` | Access mode: `public`, `private`, `groups`, `inbox` | `public` |
| `PREFIX` | **String** | `"."` | Primary command prefix | `.` |
| `ALWAYS_ONLINE` | **Boolean** | `false` | 24/7 online presence broadcast (set `false` for mobile notifications) | `false` |

---

## 👀 Auto-Status & Story Engine Variables

| Variable | Type | Default | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `AUTO_STATUS_VIEW` | **Boolean** | `true` | Automatically mark contact statuses as viewed | `true` |
| `AUTO_STATUS_REACT` | **Boolean** | `true` | Automatically react to contact statuses with emojis | `true` |
| `STATUS_EMOJIS` | **String** | `"❤️,🔥,✨,💯,🌟,⚡"` | Comma-separated list of emojis for auto-status | `"🔥,⚡,💯,✨"` |
| `STATUS_VIEWER_ONLY`| **Boolean** | `false` | Dedicated low-memory status-viewer daemon mode | `false` |

---

## ☁️ Cloud Dynamic Sync Credentials (Optional)

| Variable | Platform | Description | Example |
| :--- | :---: | :--- | :--- |
| `HKEY` / `HEROKU_API_KEY` | Heroku | Heroku API Token for dynamic `.pgvars` sync | `HRKU-xxxx-xxxx` |
| `HAPP` / `HEROKU_APP_NAME` | Heroku | Heroku App Name | `my-pgwiz-bot` |
| `KOYEB_API_TOKEN` / `K_TOKEN` | Koyeb | Koyeb API Token for dynamic `.pgvars` sync | `koyeb_api_tok_xxxx` |
| `KOYEB_SERVICE_NAME` / `K_APP`| Koyeb | Koyeb Service / App Name | `pgwiz-service` |

---

## 🗄️ Database Backends

* **Local SQLite3 (Default)**: Zero-config, sub-millisecond local SQLite storage.
* **MongoDB (Cloud)**:
```env
MONGO_URL="mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority"
```
