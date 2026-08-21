# ⚙️ Environment Configuration Guide

Configure your bot using environment variables in your deployment dashboard or local `.env` file.

---

## 🔑 Essential Variables

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `SESSION_ID` | **Yes** | Authentication session token from pairing scanner | `pgwiz_PGWIZ-MD_xxxx...` |
| `OWNER_NUMBER` | Optional | WhatsApp number(s) of bot owner (comma-separated) | `254111791418,254789462334` |
| `BOT_NAME` | Optional | Display name used by the bot | `PGWIZ-MD` |
| `MODE` | Optional | Working mode: `public`, `private`, `self`, `groups`, `inbox` | `public` |
| `PREFIX` | Optional | Command trigger prefix | `.` |

---

## 🗄️ Database Backend Connectors

PGWIZ-MD supports dual persistence engines:
1. **Local SQLite3 (Default)**: Zero-config, sub-millisecond local SQLite storage.
2. **MongoDB Cloud (Recommended for cloud)**: Multi-instance synchronization and cloud persistence.

```env
# MongoDB Connection URI (Supports MONGO_URL, MONGODB_URI, MONGO_URI)
MONGO_URL="mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority"
```
