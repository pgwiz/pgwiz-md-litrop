# 🛡️ Group Moderation & Administration

PGWIZ-MD includes a comprehensive suite of group moderation and security tools.

---

## 📢 Mention & Broadcast
* `.tagall [message]` — Mention every member in the group.
* `.hidetag [message]` — Send a broadcast with hidden mentions.
* `.totag [reply]` — Forward a message to all members.

---

## 🚨 Infraction & User Control
* `.warn @user [reason]` — Issue a warning infraction.
* `.warnings @user` — Check user infraction count.
* `.resetwarn @user` — Reset user warnings.
* `.kick @user` — Remove a member from the group.
* `.ban @user` — Blacklist a user from bot commands.
* `.unban @user` — Remove user from blacklist.

---

## 🔒 Chat Management
* `.mute` — Set group to admin-only messages.
* `.unmute` — Allow all members to send messages.
* `.clear` — Wipe message history while keeping the group in the chat list.
* `.autoclear [interval]` — Schedule automated message cleanup.
