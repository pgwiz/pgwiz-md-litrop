# 🚀 Deployment Guide

Choose your preferred deployment platform below:

---

## 1. Cloud Platforms (1-Click)
* **Heroku**: Full web dyno with automatic restart.
* **Koyeb**: Free container hosting with global edge routing.
* **Render**: Free web service deployment.
* **Railway**: Instant container provisioning.
* **Fly.io**: Ultra-low latency micro-VM hosting.
* **Pterodactyl / Wispbyte Panels**: Node.js and PNPM startup runners.

---

## 2. Termux (Android)
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

---

## 3. Ubuntu / Linux VPS (PM2)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ffmpeg curl imagemagick webp
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
git clone https://github.com/pgwiz/PGWIZ-MD.git
cd PGWIZ-MD
npm install
npm install -g pm2
pm2 start index.js --name "pgwiz-bot"
pm2 save && pm2 startup
```
