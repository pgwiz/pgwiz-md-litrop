# 🚀 Deployment Guide

Deploy PGWIZ-MD or pgwiz-md-litrop across any hosting provider in minutes.

---

## ☁️ 1. Heroku (1-Click Deployment)
1. Fork or clone the repository.
2. In your Heroku App Dashboard $ightarrow$ **Settings** $ightarrow$ **Config Vars**, add:
   * `SESSION_ID` = Your session token
   * `AUTO_STATUS_VIEW` = `true`
   * `AUTO_STATUS_REACT` = `true`
   * `STATUS_EMOJIS` = `❤️,🔥,✨,💯,🌟,⚡`
   * `ALWAYS_ONLINE` = `false`
   * `HKEY` = *(Optional)* Your Heroku API Key for dynamic `.pgvars` sync
   * `HAPP` = *(Optional)* Your Heroku App Name
3. Deploy and start the `web` dyno.

---

## 🚀 2. Koyeb (Free Container Edge Hosting)
1. Connect your GitHub repository to Koyeb.
2. Under **Environment Variables**, configure:
   * `SESSION_ID` = Your session token
   * `KOYEB_API_TOKEN` = *(Optional)* Your Koyeb API Token
   * `KOYEB_SERVICE_NAME` = *(Optional)* Your Koyeb Service Name
3. Deploy with build command `npm start` or Dockerfile.

---

## 💻 3. Linux VPS (PM2 Production Runner)
```bash
git clone https://github.com/pgwiz/PGWIZ-MD.git
cd PGWIZ-MD
npm install
npm install -g pm2
pm2 start index.js --name "pgwiz-bot"
pm2 save && pm2 startup
```

---

## 📱 4. Termux (Android)
```bash
pkg update && pkg upgrade -y
pkg install proot-distro -y
proot-distro install ubuntu
proot-distro login ubuntu
apt update && apt upgrade -y
apt install -y webp git ffmpeg curl imagemagick
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
git clone https://github.com/pgwiz/PGWIZ-MD.git
cd PGWIZ-MD
npm install
npm start
```
