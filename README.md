<div align="center">

# 🤖 PGWIZ-MD LIGHT (LITROP)
### ⚡ Ultra-Lightweight • Minimal Memory • High Performance Multi-Device WhatsApp Bot

<p align="center">
  <a href="https://youtube.com/@pgwiz">
    <img src="https://github.com/pgwiz/pgwiz-md-litrop/blob/main/assets/bot_image.jpg" alt="PGWIZ AI" width="280" style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
  </a>
</p>

<!-- Live Stats Canvas -->
<p align="center">
  <img src="https://komarev.com/ghpvc/?username=pgwiz&label=Visitors&color=00d4aa&style=flat-square" />
  <img src="https://img.shields.io/github/stars/pgwiz/pgwiz-md-litrop?color=38bdf8&style=flat-square&logo=github" />
  <img src="https://img.shields.io/github/forks/pgwiz/pgwiz-md-litrop?color=818cf8&style=flat-square&logo=github" />
  <img src="https://img.shields.io/github/repo-size/pgwiz/pgwiz-md-litrop?color=00d4aa&style=flat-square" />
  <img src="https://img.shields.io/github/last-commit/pgwiz/pgwiz-md-litrop?color=f59e0b&style=flat-square" />
  <a href="https://discord.gg/fZ7MVJM9sq">
    <img src="https://img.shields.io/discord/1391898062494105752?label=Discord&logo=discord&logoColor=white&style=flat-square&color=5865F2" alt="Discord">
  </a>
</p>

<!-- Animated Banner Canvas -->
<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3500&pause=1000&color=00D4AA&center=true&vCenter=true&width=550&lines=PGWIZ-MD+LIGHT+EDITION;ULTRA-LOW+MEMORY+FOOTPRINT;POWERED+BY+BAILEYS;FAST++SECURE++RELIABLE" alt="Typing SVG"/>
</p>

<!-- Quick Navigation Canvas -->
<p align="center">
  <a href="#-quick-deploy-canvas"><img src="https://img.shields.io/badge/🚀_Deploy-1--Click-0070f3?style=for-the-badge" alt="Deploy"></a>
  <a href="https://session-s.pgwiz.cloud/features"><img src="https://img.shields.io/badge/✨_Features-Showcase-00d4aa?style=for-the-badge" alt="Features"></a>
  <a href="https://session-s.pgwiz.cloud"><img src="https://img.shields.io/badge/🔑_Session-Scanner-ff4d4d?style=for-the-badge" alt="Pair"></a>
  <a href="#-environment-configuration-canvas"><img src="https://img.shields.io/badge/⚙️_Config-Env_Vars-8b5cf6?style=for-the-badge" alt="Env"></a>
  <a href="#-self-hosting-canvas"><img src="https://img.shields.io/badge/💻_Self-Hosting-334155?style=for-the-badge" alt="Self Host"></a>
</p>

</div>

---

## 🏗️ Architecture & Core Engine

```mermaid
flowchart LR
    WA[WhatsApp Multi-Device Cloud] <-->|Signal Ratchet WS| SCK[Baileys Engine & Health Heartbeat]
    SCK <--> AUTH[Dual Auth Engine
SQLite3 + MongoDB Sync]
    SCK <--> DISP[Message Deduplicator & Router]
    DISP --> PLUG[Modular Command Execution Engine]
    PLUG --> RES[Auto-Reaction / Media Transcoder / AI Response]
```

---

## 🛠️ Developer Tech Stack

<div align="center">

| Layer | Technologies & Frameworks |
| :--- | :--- |
| **Runtime & Core** | ![Node.js](https://img.shields.io/badge/Node.js_20+-339933?style=flat-square&logo=node.js&logoColor=white) ![JavaScript](https://img.shields.io/badge/ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Baileys](https://img.shields.io/badge/@whiskeysockets/baileys-25D366?style=flat-square&logo=whatsapp&logoColor=white) |
| **Data Persistence** | ![SQLite3](https://img.shields.io/badge/SQLite3-003B57?style=flat-square&logo=sqlite&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) |
| **Package Managers** | ![PNPM](https://img.shields.io/badge/pnpm_Fast-F69220?style=flat-square&logo=pnpm&logoColor=white) ![NPM](https://img.shields.io/badge/npm-CB3837?style=flat-square&logo=npm&logoColor=white) |
| **Hosting & Process** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![PM2](https://img.shields.io/badge/PM2-2B037A?style=flat-square&logo=pm2&logoColor=white) ![Heroku](https://img.shields.io/badge/Heroku-430098?style=flat-square&logo=heroku&logoColor=white) ![Koyeb](https://img.shields.io/badge/Koyeb-121212?style=flat-square&logo=koyeb&logoColor=white) |

</div>

---

## 🚀 Setup & Deployment

### Step 1: Fork Repository
Click the button below to fork **pgwiz-md-litrop** to your GitHub account:

<div align="center">
  <a href="https://github.com/pgwiz/pgwiz-md-litrop/fork">
    <img src="https://img.shields.io/badge/Fork-Repository-orange?style=for-the-badge&logo=github" alt="Fork Repo"/>
  </a>
</div>

---

### Step 2: Connect WhatsApp & Get Session ID
Generate your multi-device credentials in seconds using our Web Session Scanner:

<div align="center">
  <a href="https://session-s.pgwiz.cloud" target="_blank">
    <img src="https://img.shields.io/badge/GENERATE-SESSION_ID-ff4d4d?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Session ID"/>
  </a>
</div>

---

### ⚙️ Environment Configuration Canvas

Configure these variables in your deployment dashboard or local `.env` file:

#### 🔑 Essential Variables

| Environment Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `SESSION_ID` | **Required** session token generated from pairing scanner | `pgwiz_PGWIZ-MD_xxxx...` |
| `OWNER_NUMBER` | Your WhatsApp phone number (with country code) | `254111791418` |
| `BOT_NAME` | Display name used by the bot | `PGWIZ-MD` |
| `MODE` | Working mode: `public`, `private`, `self`, `groups`, `inbox` | `public` |
| `PREFIX` | Command prefix trigger | `.` |

#### 🗄️ Database Backend Connectors *(Optional — Defaults to Fast Local SQLite)*

| Database Variable | Connector Type | Format |
| :--- | :--- | :--- |
| `MONGO_URL` / `MONGODB_URI` | MongoDB Cloud Cluster | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `POSTGRES_URL` | PostgreSQL Cloud Instance | `postgres://user:pass@host:5432/dbname` |
| `MYSQL_URL` | MySQL / MariaDB Server | `mysql://user:pass@host:3306/dbname` |

---

### 🚀 1-Click Cloud Deployment Canvas

Choose your hosting provider below for instant zero-configuration deployment:

| Cloud Platform | Account Signup | 1-Click Launcher |
| :--- | :--- | :--- |
| **Heroku** | [Sign Up on Heroku](https://signup.heroku.com/) | [![Deploy on Heroku](https://img.shields.io/badge/Deploy%20on-Heroku-7056bf?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/pgwiz/pgwiz-md-litrop) |
| **Koyeb** | [Sign Up on Koyeb](https://app.koyeb.com/auth/signup) | [![Deploy on Koyeb](https://img.shields.io/badge/Deploy%20on-Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com) |
| **Railway** | [Sign Up on Railway](https://railway.app/login) | [![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/new) |
| **Render** | [Sign Up on Render](https://dashboard.render.com/register) | [![Deploy on Render](https://img.shields.io/badge/Deploy%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://dashboard.render.com) |
| **Replit** | [Sign Up on Replit](https://repl.it/) | [![Deploy on Replit](https://img.shields.io/badge/Deploy%20on-Replit-F26207?style=for-the-badge&logo=replit&logoColor=white)](https://repl.it/github/pgwiz/pgwiz-md-litrop) |
| **Sevalla** | [Sign Up on Sevalla](https://sevalla.com/signup/) | [![Deploy on Sevalla](https://img.shields.io/badge/Deploy%20on-Sevalla-0052FF?style=for-the-badge&logo=sevalla&logoColor=white)](https://sevalla.com) |
| **Fly.io** | [Sign Up on Fly.io](https://fly.io/app/sign-up) | [![Deploy on Fly.io](https://img.shields.io/badge/Deploy%20on-Fly.io-24185B?style=for-the-badge&logo=flydotio&logoColor=white)](https://fly.io) |
| **Pterodactyl / Panel** | [Sign Up via Discord](https://optiklink.com/auth) | [![Deploy on Panel](https://img.shields.io/badge/Deploy%20on-Panel-22c55e?style=for-the-badge&logo=gnu-bash&logoColor=white)](https://session-s.pgwiz.cloud/deploy/panel) |

---

## 💻 Self-Hosting Canvas

Deploy natively on **Termux (Android)**, **Linux VPS**, **RDP**, or local **Ubuntu**:

### 📱 Option 1: Termux (Android)

<details open>
<summary><b>Click to view Termux setup steps</b></summary>
<br>

**1️⃣ Setup Ubuntu Environment:**
```bash
pkg update && pkg upgrade -y
pkg install proot-distro -y
proot-distro install ubuntu
proot-distro login ubuntu
```

**2️⃣ Install System Dependencies & Node.js 20+ LTS:**
```bash
apt update && apt upgrade -y
apt install -y webp git ffmpeg curl imagemagick
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
```

**3️⃣ Clone & Launch:**
```bash
git clone https://github.com/pgwiz/pgwiz-md-litrop.git
cd pgwiz-md-litrop
npm install
npm start
```

> 💡 **Tip:** Set your `SESSION_ID` in `.env` before launching!
</details>

---

### 🖥️ Option 2: Linux VPS / RDP / Dedicated Server

<details>
<summary><b>Click to view VPS & Server setup steps</b></summary>
<br>

**1️⃣ One-Step Installation:**
```bash
# 1. Update and install packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ffmpeg curl imagemagick webp

# 2. Install Node.js 20+ LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone and install
git clone https://github.com/pgwiz/pgwiz-md-litrop.git
cd pgwiz-md-litrop
npm install
npm start
```

**2️⃣ Run 24/7 in Background with PM2:**
```bash
npm install -g pm2
pm2 start index.js --name "pgwiz-md-litrop"
pm2 save
pm2 startup
```
</details>

---

## ✨ Features Showcase

Explore the full interactive list of capabilities on our [🌐 Web Features Showcase](https://session-s.pgwiz.cloud/features).

| Category | Description & Highlights | Key Commands |
| :--- | :--- | :--- |
| 🛡️ **Group Moderation** | Tag members, manage infractions, restrict permissions, schedule auto-clearing. | `.tagall`, `.warn`, `.clear`, `.autoclear` |
| ⚡ **24/7 Automation** | Always-online presence heartbeat, auto status viewer with ignore list, auto read & reactions. | `.alwaysonline`, `.autostatus`, `.autoread`, `.autoreact` |
| 📥 **Media Downloaders** | High-speed scrapers for YouTube MP3/MP4, TikTok without watermarks, Facebook & Reels. | `.play`, `.song`, `.video`, `.tiktok`, `.fb` |
| 🎨 **Creative Tools** | Instant sticker conversion, multi-lingual TTS voice synthesizer, 3D logo maker, AI background remover. | `.sticker`, `.tts`, `.ephoto`, `.removebg` |
| 🎮 **Interactive & Games** | Turn-based Tic-Tac-Toe, smart conversational AI chatbot, custom mention stickers. | `.tictactoe`, `.chatbot`, `.mention` |
| 🔒 **Security & Safeguards** | Anti-Link, Anti-Badword, Anti-Delete message recoverer, Anti-Call, and PM spam protection. | `.antilink`, `.antidelete`, `.anticall`, `.pmblocker` |
| 👑 **Owner & Sudo Control** | Multi-owner sudo whitelist, multi-mode switcher (`public`, `private`, `self`, `groups`, `inbox`). | `.mode`, `.setsudo`, `.delsudo`, `.block` |

---

### 🌐 Join Our Community

<div align="center">
  <a href="https://t.me/GlobalTechBots">
    <img src="https://img.shields.io/badge/Join%20Telegram-0078E7?style=for-the-badge&logo=telegram&logoColor=white" alt="Join Telegram"/>
  </a>
  <a href="https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K">
    <img src="https://img.shields.io/badge/Join%20WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Join WhatsApp"/>
  </a>
</div>

---

## 📜 License & Disclaimer

- **License:** This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
- **Notice:** This bot is an independent, unofficial tool built with the Baileys library and is not affiliated with or endorsed by WhatsApp Inc.
