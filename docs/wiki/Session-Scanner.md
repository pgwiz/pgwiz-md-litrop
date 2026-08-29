# 📱 Session Pairing & QR Scanner Guide

The **PGWIZ-MD Session Scanner** is a web-based authentication server engineered with Baileys to effortlessly generate and link your WhatsApp Multi-Device bot sessions without requiring terminal access.

---

## ⚡ How It Works

1. **Pairing Code Mode (Recommended)**:
   * Enter your WhatsApp phone number with international country code (e.g. `254718252555`).
   * The scanner requests an 8-digit alphanumeric pairing code from WhatsApp servers.
   * Enter the code inside **WhatsApp $ightarrow$ Linked Devices $ightarrow$ Link with phone number**.
   * Your secure `SESSION_ID` (prefixed `pgwiz_PGWIZ-MD_...`) is generated and sent directly to your WhatsApp private chat!

2. **QR Code Mode**:
   * Open the `/qr` endpoint on the scanner site.
   * Scan the displayed QR Code with WhatsApp on your phone (**Linked Devices $ightarrow$ Link a Device**).
   * Once scanned, your session credentials are encrypted and delivered to your private chat.

---

## 🔑 Session ID Architecture

Your `SESSION_ID` contains your complete Signal protocol authentication keys packed in a resilient, base64-encoded bundle:

* **Prefix**: `pgwiz_PGWIZ-MD_`
* **Contents**:
  * Identity Key Pair
  * Noise Key
  * Registration ID
  * Signed Pre-Key & Signature
  * Account Sync Token
* **Self-Healing & Auto-Repair**:
  * If a session encountering a corrupted Signal key or Bad MAC error, the bot's auto-repair engine dynamically sanitizes and regenerates valid session keys without needing re-pairing.

---

## 🌐 Scanner Web Endpoints

| Route | Description |
| :--- | :--- |
| **`/`** or **`/pair`** | Web pairing code generator interface |
| **`/qr`** | Live SVG/Canvas QR Code scanning interface |
| **`/session`** | Session lookup and token validator |
| **`/wiki.html`** | Full interactive bot command wiki & guide |
| **`/env-vars.html`** | Interactive environment variable visualizer |
| **`/deploy.html`** | 1-Click cloud deployment launcher |

---

## 🚀 Deploying Your Own Private Session Scanner

You can host your own private session pairing portal on **Render**, **Koyeb**, **Heroku**, **Vercel**, or a **VPS**:

### 1. Render (render.yaml):
* Link the repository to Render as a Web Service.
* Build Command: `npm install`
* Start Command: `npm start`

### 2. Koyeb:
* Deploy repository as a Node.js web service on Port `8000` / `3000`.

### 3. Linux VPS / PM2:
```bash
git clone https://github.com/pgwiz/WEB-PAIR-QR.git
cd WEB-PAIR-QR
npm install
pm2 start index.js --name "session-scanner"
```

---

## 🛡️ Security & Privacy

* **Zero Cloud Storage of Plaintext Chats**: The scanner only negotiates the Signal handshake. No messages or contacts are stored on the server.
* **Instant Session Delivery**: As soon as the handshake completes, the session string is dispatched to the user's private WhatsApp chat and removed from server memory.
