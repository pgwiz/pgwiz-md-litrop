# 🛠️ Dynamic Environment Manager (`.pgvars`)

Manage and update environment variables on the fly directly inside WhatsApp with instant in-memory application and multi-cloud synchronization.

---

## 📁 Local Environment Commands

* `.pgvars list` — List all active local `.env` variables (sensitive tokens are automatically masked).
* `.pgvars set KEY=VALUE` — Update a variable live in memory and write to `.env`.
* `.pgvars delete KEY` — Delete a variable from the environment.

---

## ☁️ Heroku Platform Commands

Manage your Heroku dyno environment variables directly from WhatsApp:

| Command | Action |
| :--- | :--- |
| **`.pgvars heroku auth <API_KEY> <APP_NAME>`** | Authenticate & save Heroku credentials |
| **`.pgvars heroku list`** (or `.heroku list`) | Fetch and list all active Heroku config vars |
| **`.pgvars heroku set KEY=VALUE`** (or `.heroku set KEY=VALUE`) | Update/add variable directly on Heroku |
| **`.pgvars heroku delete KEY`** (or `.heroku delete KEY`) | Remove variable from Heroku config vars |

---

## 🚀 Koyeb Platform Commands

Manage your Koyeb microservice environment variables directly from WhatsApp:

| Command | Action |
| :--- | :--- |
| **`.pgvars koyeb auth <TOKEN> <SERVICE_NAME>`** | Authenticate & save Koyeb credentials |
| **`.pgvars koyeb list`** (or `.koyeb list`) | Fetch and list all active Koyeb environment variables |
| **`.pgvars koyeb set KEY=VALUE`** (or `.koyeb set KEY=VALUE`) | Update/add variable to Koyeb service definition |
| **`.pgvars koyeb delete KEY`** (or `.koyeb delete KEY`) | Remove variable from Koyeb service definition |

---

## ⚡ Universal Auto-Sync

When you run **`.pgvars set KEY=VALUE`**, the bot automatically:
1. Applies the update **instantly in-memory** (no reboot needed).
2. Saves it to **local `.env`**.
3. Syncs to **Heroku** (if linked).
4. Syncs to **Koyeb** (if linked).
