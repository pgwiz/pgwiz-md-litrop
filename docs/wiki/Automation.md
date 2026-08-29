# ⚡ Automation & Presence Engine

Keep your WhatsApp account active, responsive, and automated 24/7 with zero maintenance.

---

## 👀 Auto-Status Story Engine (`.autostatus`)

PGWIZ-MD features a resilient 3-step auto-status viewer and reaction engine:

### Commands:
* `.autostatus on` — Enable automatic status viewing and reacting.
* `.autostatus off` — Disable auto-status entirely.
* `.autostatus view <on|off>` — Toggle viewing without reacting.
* `.autostatus react <on|off>` — Toggle reactions.
* `.autostatus emoji <emojis>` — Set custom reaction emojis (e.g. `.autostatus emoji ❤️,🔥,⚡,💯`).
* `.autostatus ignore <number>` — Add a contact to the ignore list (statuses from this number will never be viewed/reacted).
* `.autostatus unignore <number>` — Remove a contact from the ignore list.
* `.autostatus ignored` — View all ignored contacts.

### 🛡️ Safety & Anti-Spam Features:
* **120-Second Age Guard**: Discards status backlogs older than 2 minutes on startup to prevent reaction storms.
* **Persistent SQLite Deduplication**: Remembers reacted statuses across bot restarts.
* **Zero DM Spam**: Reactions are delivered strictly to `status@broadcast` without polluting contact private chats.

---

## 🟢 Always-Online & Presence Heartbeat (`.alwaysonline`)

* `.alwaysonline on` — Keeps bot online 24/7 with active 8-second keepalive heartbeats.
* `.alwaysonline off` — Drops online presence and maintains `unavailable` state. **This preserves native WhatsApp push notifications on your phone.**

---

## 🧹 Non-Destructive Chat Cleaner (`.clear` & `.autoclear`)

* `.clear` — Clears all message bubbles inside the current chat while **keeping the conversation in your chat list**.
* `.autoclear <interval>` — Automatically schedules periodic message clearing.
