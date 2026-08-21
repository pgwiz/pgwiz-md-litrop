# 📖 Complete Command Reference (242 Commands)

Below is the complete categorized reference of all 242 plugins and commands available in PGWIZ-MD.

---

## 📂 Category: ADMIN (25 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.wipe` | `.wipe [bot | all | prefix] [count]` | ⚡ Public | Force delete messages (bot/all/prefix) |
| `.antibadword` | `.antibadword <on|off|add|remove|list>` | 🛡️ Admin | Configure anti-badword filter to delete messages containing inappropriate words |
| `.antilink` | `.antilink <on|off|set>` | 🛡️ Admin | Prevent users from sending links in the group |
| `.antitag` | `.antitag <on|off|set>` | 🛡️ Admin | Prevent users from tagging all members |
| `.chatbot` | `.chatbot <on|off>` | 🛡️ Admin | Enable or disable AI chatbot for the group |
| `.delete` | `.delete <count> [@user] or reply with .delete` | 🛡️ Admin | Delete recent messages from group or specific user |
| `.demote` | `.demote @user or reply to message` | 🛡️ Admin | Demote user(s) from admin to member |
| `.goodbye` | `.goodbye <on|off|set message>` | 🛡️ Admin | Configure goodbye messages for leaving members |
| `.hidetag` | `.hidetag <message> or reply to message` | 🛡️ Admin | Tag all non-admin members without showing their names |
| `.kick` | `.kick @user or reply to message` | 🛡️ Admin | Remove user(s) from the group |
| `.mute` | `.mute [duration in minutes]` | 🛡️ Admin | Mute the group for a specified duration |
| `.pgvars` | `.pgvars <list/update/delete> [KEY=VALUE]` | 👑 Owner | Manage .env variables (Owner Only) |
| `.promote` | `.promote [@user] or reply to message` | 🛡️ Admin | Promote user(s) to admin |
| `.resetlink` | `.resetlink` | 🛡️ Admin | Reset group invite link |
| `.setgdesc` | `.setgdesc <new description>` | 🛡️ Admin | Change group description |
| `.setgname` | `.setgname <new name>` | 🛡️ Admin | Change group name |
| `.setgpp` | `.setgpp (reply to image)` | 🛡️ Admin | Change group profile picture |
| `.tag` | `.tag [message] or reply to a message` | 🛡️ Admin | Tag all group members |
| `.tagall` | `.tagall` | 🛡️ Admin | Tag all group members with their usernames |
| `.tagnotadmin` | `.tagnotadmin` | 🛡️ Admin | Tag all non-admin members in the group |
| `.unban` | `.unban [@user] or reply to message` | ⚡ Public | Unban a user from using the bot |
| `.unmute` | `.unmute` | 🛡️ Admin | Unmute the group |
| `.vvadmin` | `.vvadmin (reply to a view-once media)` | ⚡ Public | Forward a view-once media (image/video/audio) to the main admin. |
| `.warn` | `.warn [@user] or reply to message` | 🛡️ Admin | Warn a user (auto-kick after 3 warnings) |
| `.welcome` | `.welcome [on/off/message]` | 🛡️ Admin | Configure welcome message for the group |

## 📂 Category: OWNER (41 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.getfile` | `.getfile <filename>` | ⚡ Public | Read and display file contents from bot directory |
| `.setbio` | `.setbio <on|off|set|reset>` | 👑 Owner | Set custom WhatsApp bio with random quotes |
| `.alwaysonline` | `.alwaysonline <on|off|true|false>` | 👑 Owner | Toggle bot continuous online presence (on/off, true/false) |
| `.anticall` | `.anticall <on|off|status>` | 👑 Owner | Enable or disable auto-blocking of incoming calls |
| `.antidelete` | `.antidelete <on|off>` | 👑 Owner | Enable or disable antidelete feature to track deleted messages |
| `.autoreact` | `.autoreact on/off` | 👑 Owner | Toggle auto-react to messages |
| `.autoclear` | `.autoclear <on|off|set <time>|status|list>` | 👑 Owner | Set automatic periodic chat clearing on a group or DM (e.g. .autoclear on, .autoclear set 12h) |
| `.autoread` | `.autoread <on|off>` | 👑 Owner | Toggle automatic message reading (blue ticks) |
| `.autostatus` | `.autostatus <on|off|react on|react off|ignore <num>|unignore <num>|ignored>` | 👑 Owner | Automatically view and react to WhatsApp statuses |
| `.autotyping` | `.autotyping <on|off>` | 👑 Owner | Toggle auto-typing indicator when bot is processing messages |
| `.clear` | `.clear` | 👑 Owner | Clear messages from the current chat or group |
| `.clearsession` | `.clearsession` | ⚡ Public | Clear session files |
| `.cleartmp` | `.cleartmp` | ⚡ Public | Clear tmp and temp directories |
| `.creact` | `.creact on/off` | 👑 Owner | Toggle command reactions |
| `.delcmd` | `.delcmd <text>` | 👑 Owner | Delete a sticker command |
| `.delplugin` | `.delplugin <plugin_name>` | ⚡ Public | Delete a plugin by name (owner only) |
| `.inspect` | `.inspect [plugin_name]` | ⚡ Public | Read the source code of a specific plugin |
| `.gitclone` | `.gitclone <url> OR <username> <repo>` | ⚡ Public | Download a GitHub repository as zip |
| `.gitinfo` | `.gitinfo` | 👑 Owner | Show detailed git repository information |
| `.addplugin` | `.addplugin <Gist URL>` | ⚡ Public | Install a plugin from a GitHub Gist URL (owner only) |
| `.listcmd` | `.listcmd` | ⚡ Public | List all sticker commands |
| `.listrent` | `.listrent` | ⚡ Public | List all currently active sub-bots |
| `.maintenance` | `.maintenance [minutes / stop]` | ⚡ Public | Disable non-owner commands for a duration or stop it early |
| `.manage` | `.manage [toggle/alias] [command_name] [new_alias]` | ⚡ Public | Manage bot commands and aliases |
| `.mention` | `.mention <on|off> or .setmention (reply to media)` | 👑 Owner | Toggle or set custom mention reply |
| `.mode` | `.mode [public|private|groups|inbox|self|status]` | 👑 Owner | Advanced bot access control - Set who can use the bot and where |
| `.pmblocker` | `.pmblocker <on|off|status|setmsg>` | 👑 Owner | Block private messages and auto-block users who DM the bot |
| `.gitpull` | `.gitpull` | 👑 Owner | Reload all plugins (Pull changes from git if available) |
| `.reload` | `.reload` | 👑 Owner | Reload all plugins |
| `.rentbot` | `.rentbot 92305xxxxxxx` | ⚡ Public | Start a sub-bot clone via pairing code |
| `.setcmd` | `.setcmd <text>` | 👑 Owner | Set a sticker command |
| `.setpp` | `.setpp (reply to an image)` | ⚡ Public | Set or update the bot profile picture (owner only) |
| `.settings` | `.settings` | ⚡ Public | Show bot settings and per-group configurations |
| `.stealth` | `.stealth <on|off>` | ⚡ Public | Toggle online status - bot will not send presence updates if off |
| `.stoprent` | `.stoprent [number/all]` | ⚡ Public | Stop a specific sub-bot or all sub-bots |
| `.sudo` | `.sudo add|del|list <@user|number>` | 👑 Owner | Add or remove sudo users or list them |
| `.update` | `.update [zip_url]` | 👑 Owner | Update bot from git or zip without stopping |
| `.upres` | `.upres` | 👑 Owner | Update the bot and hot-reload commands without killing the process. |
| `.pgwavs` | `.pgwavs set <channel_jid> [channel_name]` | 👑 Owner | Set the WhatsApp Channel that appears on the menu |
| `.removeplugin` | `.removeplugin <plugin_name>` | 👑 Owner | Remove an installed plugin |
| `.updateforce` | `.updateforce` | 👑 Owner | Force update bot (even if no changes detected) |

## 📂 Category: TOOLS (37 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.chhistory` | `.chhistory <ChannelJID>` | ⚡ Public | Fetch IDs of previous channel posts |
| `.base64` | `.base64 <text> OR reply to a message` | ⚡ Public | Encode text to Base64 |
| `.bfdecode` | `Reply to BF code with .bfdecode` | ⚡ Public | Decode/Run Brainfuck code |
| `.brainfuck` | `.brainfuck <text> OR reply to a message` | ⚡ Public | Convert text into Brainfuck code |
| `.convert` | `.convert <from_unit> <to_unit> <value>` | ⚡ Public | Convert units (e.g., c → f, m → km, kg → g) |
| `.excard` | `.excard Title | Body | ImageURL` | ⚡ Public | Create a rich media card |
| `.fetch` | `.fetch <url>` | ⚡ Public | Download a file directly from a URL |
| `.flip` | `.flip <text> OR reply to a message` | ⚡ Public | Flip text upside down (supports Uppercase) |
| `.forwarded` | `.viral <text> OR reply to a message` | ⚡ Public | Send text with a fake  |
| `.grayscale` | `Reply to an image with .grayscale` | ⚡ Public | Convert an image to grayscale |
| `.handwrite` | `.handwrite <text>` | ⚡ Public | Convert text to handwritten-style image |
| `.blur` | `.blur (reply to an image or send image with caption)` | ⚡ Public | Apply a blur effect to an image |
| `.invert` | `Reply to an image with .invert` | ⚡ Public | Convert an image to negative |
| `.qrcode` | `.qrcode <text>` | ⚡ Public | Generate a QR code from text |
| `.customqr` | `.customqr <text> | <size> | <color>` | ⚡ Public | Generate a custom QR code from text with optional size and color |
| `.qmaker` | `.qmaker <text> or reply to a message` | ⚡ Public | Create a quote image from text or replied message |
| `.readmore` | `.readmore text\n.readmore text1|text2` | ⚡ Public | Hide text using read more |
| `.readqr` | `Reply to an image with .readqr` | ⚡ Public | Read QR code from an image |
| `.remini` | `.remini <image_url> or reply to an image with .remini` | ⚡ Public | Enhance an image using Remini AI |
| `.removebg` | `.removebg (reply to image or send image with caption)` | ⚡ Public | Remove background from an image |
| `.length` | `.length <size> (reply to media)` | ⚡ Public | Send an image or video with a custom file length |
| `.reverse` | `.reverse <text>` | ⚡ Public | Reverse any text |
| `.seo` | `.seo <url>` | ⚡ Public | Get full SEO analysis of a website (split into multiple messages for WhatsApp) |
| `.sepia` | `Reply to an image with .sepia` | ⚡ Public | Convert an image to sepia |
| `.sharpen` | `Reply to an image with .sharpen` | ⚡ Public | Convert an image to sharpen |
| `.getpage` | `.getpage <url>` | ⚡ Public | Get the raw HTML source of a website |
| `.spoof` | `.spoof @user | StatusText | YourReply` | ⚡ Public | Send a message replying to a fake status |
| `.screenshot` | `.screenshot <url>` | ⚡ Public | Get a screenshot of a website |
| `.tinyurl` | `.tinyurl <url>` | ⚡ Public | Shorten a URL using TinyURL |
| `.smallcaps` | `.smallcaps <text> OR reply to a message` | ⚡ Public | Convert text to small-capital style |
| `.tourl` | `.tourl (reply to media or send media with caption)` | ⚡ Public | Upload media and get a URL. |
| `.translate` | `.translate <text> <lang> or reply to a message with .translate <lang>` | ⚡ Public | Translate text to the specified language. |
| `.tts` | `.tts <text> or reply to a message with .tts` | ⚡ Public | Convert text to speech and send as an audio message. |
| `.unshorten` | `.unshorten <short_url>` | ⚡ Public | See where a short link actually goes |
| `.url` | `.url (send or reply to media)` | ⚡ Public | Get a URL for media (image, video, audio, sticker, document). |
| `.vnote` | `Reply to an audio file with .vnote` | ⚡ Public | Convert any audio message into a live-looking voice note |
| `.walink` | `.walink <number> or reply to a user with .wa` | ⚡ Public | Generate a WhatsApp link from a phone number. |

## 📂 Category: DOWNLOAD (19 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.ytvid` | `.ytvid <youtube url> [quality]` | ⚡ Public | Download YouTube videos |
| `.alamy` | `.alamy <Alamy URL>` | ⚡ Public | Download image or video from Alamy URL |
| `.facebook` | `.fb <facebook video link>` | ⚡ Public | Download Facebook videos |
| `.getty` | `.getty <Getty URL>` | ⚡ Public | Download video or image from Getty Images |
| `.gimage` | `.gimage <search query>` | ⚡ Public | Search and send first 4 Google images |
| `.gitclone2` | `.gitclone2 <github-link>` | ⚡ Public | Download a GitHub repository as a ZIP file |
| `.instagram` | `.ig <instagram link>` | ⚡ Public | Download Instagram posts, reels & videos |
| `.istock` | `.istock <iStock URL>` | ⚡ Public | Download image or video from iStock URL |
| `.mediafire` | `.mediafire <url>` | ⚡ Public | Download files from MediaFire |
| `.mega` | `.mega <mega-url>` | ⚡ Public | Download from MEGA with real-time progress |
| `.sharechat` | `.sharechat <ShareChat URL>` | ⚡ Public | Download video from ShareChat |
| `.snack` | `.snack <SnackVideo URL>` | ⚡ Public | Download media (video or image) from SnackVideo URL |
| `.snapchat` | `.snapchat <Snapchat URL>` | ⚡ Public | Download media (video or image) from Snapchat Spotlight URL |
| `.spotify` | `.spotify <song/artist/keywords>` | ⚡ Public | Download music from Spotify |
| `.dlstatus` | `Reply to a status and type .dlstatus` | ⚡ Public | Download quoted Status updates |
| `.tiktok` | `.tiktok <TikTok URL>` | ⚡ Public | Download TikTok video without watermark (HD if available) |
| `.twitter` | `.twitter <Tweet URL>` | ⚡ Public | Download media (video or image) from X/Twitter post |
| `.video` | `.video <youtube link | search query>` | ⚡ Public | Download YouTube videos by link or search |
| `.vidsplay` | `.vidsplay <Vidsplay URL>` | ⚡ Public | Download video and thumbnail from Vidsplay |

## 📂 Category: MUSIC (6 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.ytsearch` | `.yts [query]` | ⚡ Public | Search YouTube |
| `.lyrics` | `.lyrics <song name>` | ⚡ Public | Get lyrics of a song along with artist and image |
| `.play` | `.play <song name>` | ⚡ Public | Search and download a song as MP3 from Spotify |
| `.ringtone` | `.ringtone <search term>` | ⚡ Public | Search and download ringtones |
| `.scloud` | `.scloud <song name>` | ⚡ Public | Search for tracks on SoundCloud |
| `.song` | `.song <song name>` | ⚡ Public | Play music from YouTube (Search & Select) |

## 📂 Category: AI (3 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.gpt` | `.gpt <question> or .gemini <question>` | ⚡ Public | Ask a question to AI (GPT or Gemini) |
| `.imagine` | `.imagine <prompt>` | ⚡ Public | Generate an AI image based on your prompt |
| `.sora` | `.sora <prompt>` | ⚡ Public | Generate AI video from text prompt |

## 📂 Category: GENERAL (16 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.alive` | `.alive` | ⚡ Public | Check bot status and system info |
| `.channelid` | `.channelid <url>` | ⚡ Public | Get the internal JID of a WhatsApp Channel |
| `.echo` | `.echo <text> <count>` | ⚡ Public | Repeats your message a specified number of times. |
| `.getpp` | `.getpp @user or reply or number` | ⚡ Public | Get user profile picture |
| `.menu` | `.menu [command]` | ⚡ Public | Show all commands |
| `.pair` | `.pair 92305395XXXX` | ⚡ Public | Get session id for PGWIZ-MD |
| `.ping` | `.ping` | ⚡ Public | Check bot response time |
| `.pingweb` | `.pingweb [website URL]` | ⚡ Public | Check bot response time and ping a website |
| `.find` | `.find [keyword]` | ⚡ Public | Find a command by keyword or description |
| `.smenu` | `.smenu` | ⚡ Public | Interactive smart menu with live status |
| `.perf` | `.perf` | ⚡ Public | View command performance and error metrics |
| `.uptime` | `.uptime` | ⚡ Public | Show bot status information |
| `.version` | `.version` | ⚡ Public | Display bot edition, version and system info |
| `.viewonce` | `.viewonce (reply to a view-once media)` | ⚡ Public | Re-send a view-once image, video, or voice note. |
| `.developer` | `.developer` | ⚡ Public | Show developer and project information |
| `.save` | `.save <text> | reply + .save | .save list | .save del <id>` | ⚡ Public | Save a text snippet for later |

## 📂 Category: APKS (6 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.android` | `.android <apk_name>` | ⚡ Public | Search APKs and download by reply |
| `.apkmirror` | `.apkmirror <apk_name>` | ⚡ Public | Search APKs from APKMirror and download by reply |
| `.apkpure` | `.apkpure <apk_name>` | ⚡ Public | Search APKs from APKPure and get download link |
| `.hmod` | `.hmod <query>` | ⚡ Public | Search APKs from HappyMod |
| `.pstore` | `.pstore <app_name>` | ⚡ Public | Search apps on Play Store and get app details |
| `.sfile` | `.sfile <query>` | ⚡ Public | Search APKs/files from SFile |

## 📂 Category: MENU (8 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.animu` | `.animu <type>` | ⚡ Public | Send anime stickers or quotes |
| `.animes` | `.animes <anime_name>` | ⚡ Public | Send random anime images |
| `.audiofx` | `.bass / .nightcore (reply to audio)` | ⚡ Public | Apply audio effects to voice notes |
| `.canvas` | `.canvas <type> [args]` | ⚡ Public | Generate various fun images using avatar |
| `.notes` | `.notes <add|all|del|delall> [text|ID]` | ⚡ Public | Store, view, and delete your personal notes |
| `.images` | `.images <category>` | ⚡ Public | Send 3 random images for a given category |
| `.stext` | `.stext <text>` | ⚡ Public | Style text in different fancy formats |
| `.ephoto` | `.ephoto <type> <text>` | ⚡ Public | Generate styled text with various effects |

## 📂 Category: STICKERS (12 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.attp` | `.attp <text>` | ⚡ Public | Generate an animated sticker from text |
| `.emojimix` | `.emojimix 😎+🥰` | ⚡ Public | Mix two emojis into a sticker |
| `.gif` | `.gif <search term>` | ⚡ Public | Get a GIF based on a search term |
| `.igs` | `.igs <instagram URL>` | ⚡ Public | Convert Instagram post/reel to sticker |
| `.igsc` | `.igsc <instagram URL>` | ⚡ Public | Convert Instagram post/reel to cropped sticker |
| `.s2img` | `.s2img (reply to a sticker)` | ⚡ Public | Convert a sticker to an image |
| `.sticker` | `.sticker (reply to image/video)` | ⚡ Public | Convert an image or video into a sticker |
| `.sticker2` | `.sticker2 (reply to image/video or send with caption)` | ⚡ Public | Convert image/video to sticker |
| `.crop` | `.crop (reply to image/video/sticker)` | ⚡ Public | Crop image/video/sticker to circle sticker |
| `.stickers` | `.stickers <search term>` | ⚡ Public | Search for stickers using Tenor |
| `.tgstk` | `.tgstk <telegram sticker URL>` | ⚡ Public | Download stickers from Telegram |
| `.take` | `.take <packname> (reply to sticker)` | ⚡ Public | Change sticker pack name |

## 📂 Category: GROUP (14 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.ban` | `.ban @user or reply to message` | ⚡ Public | Ban a user from using the bot |
| `.character` | `.character @user` | ⚡ Public | Analyze someone\ |
| `.compliment` | `.compliment @user` | ⚡ Public | Send a random compliment to a user |
| `.add` | `.add <number> or reply to vcard/message` | ⚡ Public | Add a user to the group |
| `.groupinfo` | `.groupinfo` | 👥 Group | Display detailed group information |
| `.insult` | `.insult @username or reply to their message with .insult` | ⚡ Public | Send a playful insult to someone by mentioning them or replying to their message |
| `.rank` | `.rank` | 👥 Group | Show top 5 most active members based on message count |
| `.ship` | `.ship` | 👥 Group | Randomly ship two members in the group |
| `.simp` | `.simp (reply to user or mention someone)` | ⚡ Public | Generate a simp card for a user |
| `.staff` | `.staff` | 👥 Group | Display list of group admins |
| `.stupid` | `.stupid (reply to user, mention someone, or add text)` | ⚡ Public | Generate a stupid card for a user |
| `.warnings` | `.warnings [@user]` | 👥 Group | Check warning count of a user |
| `.wasted` | `.wasted @user` | ⚡ Public | Waste someone in style! |
| `.gid` | `.gid` | 👥 Group | Show the current group ID |

## 📂 Category: SEARCH (6 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.bing` | `.bing <query>` | ⚡ Public | Search something on Bing |
| `.define` | `.define <word>` | ⚡ Public | Search a word on Dictionary |
| `.element` | `.element <name or symbol>` | ⚡ Public | Get information about a chemical element |
| `.whoisip` | `.ip <address/domain>` | ⚡ Public | Get location info from an IP or Domain |
| `.wattpad` | `.wattpad <query>` | ⚡ Public | Search for stories on Wattpad! |
| `.wiki` | `.wiki <query>` | ⚡ Public | Search Wikipedia for a topic! |

## 📂 Category: IMAGES (7 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.coding` | `.coding` | ⚡ Public | Get a random programming image |
| `.cyberimg` | `.cyberimg` | ⚡ Public | Get a random cyberspace image |
| `.game` | `.game` | ⚡ Public | Get a random gaming image |
| `.islamic` | `.islamic` | ⚡ Public | Get a random Islamic image |
| `.mountain` | `.mountain` | ⚡ Public | Get a random mountain image |
| `.pies` | `.pies <country>\nAvailable countries: ${VALID_COUNTRIES.join(` | ⚡ Public | Get a pies image from a specific country |
| `.tech` | `.tech` | ⚡ Public | Get a random tech image |

## 📂 Category: GAMES (7 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.dado` | `.dado` | ⚡ Public | Roll a random dice sticker |
| `.dare` | `.dare` | ⚡ Public | Get a random dare |
| `.hangman` | `.hangman to start, then .guess <letter>` | ⚡ Public | Play hangman word guessing game |
| `.math` | `.math` | ⚡ Public | Solve math problems |
| `.tictactoe` | `.tictactoe [room name]` | 👥 Group | Play TicTacToe game with another user |
| `.trivia` | `.trivia [answer]` | ⚡ Public | Start a trivia game or answer the question |
| `.truth` | `.truth` | ⚡ Public | Get a random truth from the Shizo API. |

## 📂 Category: FUN (9 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.8ball` | `.8ball Will I be rich?` | ⚡ Public | Ask the magic 8-ball a question |
| `.fact` | `.fact` | ⚡ Public | Get a random interesting fact |
| `.flirt` | `.flirt` | ⚡ Public | Get a random flirt message |
| `.hack` | `.hack <target>` | ⚡ Public | Simulate a hack sequence (fun prank) |
| `.joke` | `.joke` | ⚡ Public | Get a random dad joke |
| `.joke2` | `.joke2` | ⚡ Public | Get a random general joke |
| `.meme` | `.meme` | ⚡ Public | Get a random cheems meme with buttons for another meme or joke |
| `.teddy` | `.teddy` | ⚡ Public | Send an animated teddy with cute emojis |
| `.why` | `.why` | ⚡ Public | Get a random “why” question from the API |

## 📂 Category: STALK (8 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.genshin` | `.genshin <UID>` | ⚡ Public | Stalk Genshin Impact UID |
| `.github` | `.github <username>` | ⚡ Public | Lookup GitHub user profile |
| `.npmstalk` | `.npmstalk <package-name>` | ⚡ Public | Get details about an NPM package |
| `.pinstalk` | `.pinstalk <username>` | ⚡ Public | Lookup Pinterest user profile |
| `.tgstalk` | `.tgstalk <username>` | ⚡ Public | Lookup Telegram channel or user |
| `.thrstalk` | `.thrstalk <username>` | ⚡ Public | Lookup Threads user profile |
| `.ttstalk` | `.ttstalk <username>` | ⚡ Public | Lookup TikTok user profile |
| `.xstalk` | `.xstalk <username>` | ⚡ Public | Lookup Twitter user profile |

## 📂 Category: INFO (12 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.script` | `.script` | ⚡ Public | Get information about the PGWIZ-MD GitHub repository |
| `.imdb` | `.imdb <movie/series title>` | ⚡ Public | Get detailed information about a movie or series from IMDB |
| `.itunes` | `.itunes <song name>` | ⚡ Public | Get detailed information about a song from iTunes |
| `.news` | `.news` | ⚡ Public | Get the latest top 5 news headlines from the US |
| `.owner` | `.owner` | ⚡ Public | Get developer & owner information |
| `.pokedex` | `.pokedex <pokemon name>` | ⚡ Public | Get information about a Pokémon |
| `.shazam` | `.shazam (reply to audio or video)` | ⚡ Public | Identify a song from audio or video |
| `.string` | `.string <text>` | ⚡ Public | Get detailed info about a text string |
| `.trends` | `.trends <country-name>` | ⚡ Public | Get trending topics from a country. |
| `.weather` | `.weather <city>` | ⚡ Public | Get the current weather for a specific city! |
| `.whois` | `.whois <domain>` | ⚡ Public | Get WHOIS information of a domain |
| `.jid` | `.jid [@user|reply|number]` | ⚡ Public | Get JID (WhatsApp ID) of a user |

## 📂 Category: QUOTES (6 Commands)

| Command | Usage | Permissions | Description |
| :--- | :--- | :--- | :--- |
| `.goodnight` | `.goodnight` | ⚡ Public | Send a random good night message |
| `.quote` | `.quote` | ⚡ Public | Get a random quote |
| `.quote2` | `.quote2` | ⚡ Public | Get a random inspirational quote |
| `.roseday` | `.roseday` | ⚡ Public | Get a random Rose Day message/quote |
| `.shayari` | `.shayari` | ⚡ Public | Get a random shayari |
| `.wyr` | `.wyr` | ⚡ Public | Get a Would You Rather question |
