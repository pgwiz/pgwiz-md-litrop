/*****************************************************************************
 *                                                                           *
 *                     Developed By Bot Owner                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/pgwiz                         *
 *  ▶️  YouTube  : https://youtube.com/@pgwiz                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K     *
 *                                                                           *
 *    © 2026 pgwiz. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the PGWIZ-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/


const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

let printLog = null
try {
  const print = require('./print')
  printLog = print.printLog
} catch (e) {
  printLog = (type, msg) => console.log(`[${type.toUpperCase()}] ${msg}`)
}

const STORE_FILE = './baileys_store.json'
const MESSAGE_COUNT_FILE = './data/messageCount.json'
const MONGO_URL = process.env.MONGO_URL
const POSTGRES_URL = process.env.POSTGRES_URL
const MYSQL_URL = process.env.MYSQL_URL
const SQLITE_URL = process.env.DB_URL || path.join(__dirname, '..', 'baileys_store.db')

const MESSAGE_LIMITS = {
  memory: 20,
  sqlite: 70,
  mongo: Infinity,
  postgres: Infinity,
  mysql: Infinity
}

let MAX_MESSAGES = 20
try {
  const settings = require('../settings.js')
  if (settings.maxStoreMessages && typeof settings.maxStoreMessages === 'number') {
    MAX_MESSAGES = settings.maxStoreMessages
  }
} catch (e) {
  // Use default if settings not available
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL = 60 * 60 * 1000

const compress = (obj) => {
  try {
    return zlib.deflateSync(JSON.stringify(obj))
  } catch (e) {
    console.error('[STORE] Compression error:', e.message)
    return Buffer.from(JSON.stringify(obj))
  }
}

const decompress = (buf) => {
  try {
    return JSON.parse(zlib.inflateSync(buf))
  } catch (e) {
    console.error('[STORE] Decompression error:', e.message)
    try {
      return JSON.parse(buf.toString())
    } catch (e2) {
      return null
    }
  }
}

function slimMessage(msg) {
  return {
    key: msg.key,
    message: msg.message,
    messageTimestamp: msg.messageTimestamp,
    participant: msg.participant,
    pushName: msg.pushName,
    broadcast: msg.broadcast
  }
}

function normalizeToJid(value) {
  if (!value) return ''
  const cleaned = String(value).trim()
  if (!cleaned) return ''
  if (cleaned.includes('@')) return cleaned
  const digits = cleaned.replace(/\D/g, '')
  return digits ? `${digits}@s.whatsapp.net` : ''
}

function parseCsvList(input) {
  if (!input) return []
  return String(input)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

let backend = 'memory'
let adapters = {}
let cleanupTimer = null
let messageLimit = MESSAGE_LIMITS.memory

/**
* ----------------- MongoDB -----------------
*/

if (MONGO_URL) {
  try {
    const mongoose = require('mongoose')

    const msgSchema = new mongoose.Schema({
      jid: { type: String, index: true },
      id: { type: String, unique: true },
      data: Buffer,
      ts: { type: Number, index: true }
    })

    const countSchema = new mongoose.Schema({
      chatId: { type: String, required: true },
      userId: { type: String, required: true },
      count: { type: Number, default: 0 }
    })
    countSchema.index({ chatId: 1, userId: 1 }, { unique: true })

    const metaSchema = new mongoose.Schema({
      key: { type: String, unique: true, required: true },
      value: { type: String, required: true }
    })

    const contactSchema = new mongoose.Schema({
      jid: { type: String, unique: true, required: true },
      name: { type: String, default: '' },
      notify: String,
      verifiedName: String,
      ts: { type: Number, default: Date.now }
    })

    const chatSchema = new mongoose.Schema({
      jid: { type: String, unique: true, required: true },
      name: String,
      conversationTimestamp: Number,
      unreadCount: { type: Number, default: 0 },
      ts: { type: Number, default: Date.now }
    })

    const settingSchema = new mongoose.Schema({
      chatId: { type: String, required: true },
      key: { type: String, required: true },
      value: mongoose.Schema.Types.Mixed,
      ts: { type: Number, default: Date.now }
    })
    settingSchema.index({ chatId: 1, key: 1 }, { unique: true })

    const userSchema = new mongoose.Schema({
      jid: { type: String, unique: true, required: true },
      firstSeen: { type: Number, default: Date.now },
      lastSeen: { type: Number, default: Date.now },
      messageCount: { type: Number, default: 0 },
      banned: { type: Boolean, default: false },
      premium: { type: Boolean, default: false }
    })

    const userInfoSchema = new mongoose.Schema({
      jid: { type: String, unique: true, required: true },
      pushName: { type: String, default: '' },
      displayName: { type: String, default: '' },
      extras: mongoose.Schema.Types.Mixed,
      ts: { type: Number, default: Date.now }
    })

    const ownerJidSchema = new mongoose.Schema({
      jid: { type: String, unique: true, required: true },
      source: { type: String, default: 'settings' },
      ts: { type: Number, default: Date.now }
    })

    const disabledPluginSchema = new mongoose.Schema({
      name: { type: String, unique: true, required: true },
      reason: { type: String, default: '' },
      ts: { type: Number, default: Date.now }
    })

    mongoose.connect(MONGO_URL).catch(err => console.error('[MONGO] Connection error:', err))

    const Msg = mongoose.model('Message', msgSchema)
    const MsgCount = mongoose.model('MessageCount', countSchema)
    const Meta = mongoose.model('Metadata', metaSchema)
    const Contact = mongoose.model('Contact', contactSchema)
    const Chat = mongoose.model('Chat', chatSchema)
    const Setting = mongoose.model('Setting', settingSchema)
    const User = mongoose.model('User', userSchema)
    const UserInfo = mongoose.model('UserInfo', userInfoSchema)
    const OwnerJid = mongoose.model('OwnerJid', ownerJidSchema)
    const DisabledPlugin = mongoose.model('DisabledPlugin', disabledPluginSchema)

    adapters.mongo = {
      async save(jid, id, msg) {
        try {
          await Msg.updateOne(
            { jid, id },
            { data: compress(msg), ts: Date.now() },
            { upsert: true }
          )
        } catch (e) {
          console.error(`[MONGO] Save error:`, e.message)
        }
      },

      async load(jid, id) {
        try {
          const row = await Msg.findOne({ jid, id })
          return row ? decompress(row.data) : null
        } catch (e) {
          console.error(`[MONGO] Load error:`, e.message)
          return null
        }
      },

      async incrementCount(chatId, userId) {
        try {
          await MsgCount.updateOne(
            { chatId, userId },
            { $inc: { count: 1 } },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Increment count error:', e.message)
        }
      },

      async getCount(chatId, userId) {
        try {
          const doc = await MsgCount.findOne({ chatId, userId })
          return doc ? doc.count : 0
        } catch (e) {
          console.error('[MONGO] Get count error:', e.message)
          return 0
        }
      },

      async getAllCounts() {
        try {
          const docs = await MsgCount.find({})
          const result = { isPublic: true, messageCount: {} }
          docs.forEach(doc => {
            if (!result.messageCount[doc.chatId]) {
              result.messageCount[doc.chatId] = {}
            }
            result.messageCount[doc.chatId][doc.userId] = doc.count
          })
          const meta = await Meta.findOne({ key: 'isPublic' })
          if (meta) result.isPublic = meta.value === 'true'
          return result
        } catch (e) {
          console.error('[MONGO] Get all counts error:', e.message)
          return { isPublic: true, messageCount: {} }
        }
      },

      async setPublicMode(isPublic) {
        try {
          await Meta.updateOne(
            { key: 'isPublic' },
            { key: 'isPublic', value: isPublic.toString() },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Set public mode error:', e.message)
        }
      },

      async setMetadata(key, value) {
        try {
          await Meta.updateOne(
            { key },
            { key, value: value.toString() },
            { upsert: true }
          )
        } catch (e) {
          console.error(`[MONGO] Set metadata error:`, e.message)
        }
      },

      async getMetadata(key) {
        try {
          const doc = await Meta.findOne({ key })
          return doc ? doc.value : null
        } catch (e) {
          console.error(`[MONGO] Get metadata error:`, e.message)
          return null
        }
      },

      async saveContact(jid, contact) {
        try {
          await Contact.updateOne(
            { jid },
            { ...contact, jid, ts: Date.now() },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Save contact error:', e.message)
        }
      },

      async getContact(jid) {
        try {
          return await Contact.findOne({ jid })
        } catch (e) {
          console.error('[MONGO] Get contact error:', e.message)
          return null
        }
      },

      async getAllContacts() {
        try {
          const docs = await Contact.find({})
          const result = {}
          docs.forEach(doc => {
            result[doc.jid] = { id: doc.jid, name: doc.name, notify: doc.notify }
          })
          return result
        } catch (e) {
          console.error('[MONGO] Get all contacts error:', e.message)
          return {}
        }
      },

      async saveChat(jid, chat) {
        try {
          await Chat.updateOne(
            { jid },
            { ...chat, jid, ts: Date.now() },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Save chat error:', e.message)
        }
      },

      async getChat(jid) {
        try {
          return await Chat.findOne({ jid })
        } catch (e) {
          console.error('[MONGO] Get chat error:', e.message)
          return null
        }
      },

      async getAllChats() {
        try {
          const docs = await Chat.find({})
          const result = {}
          docs.forEach(doc => {
            result[doc.jid] = {
              id: doc.jid,
              name: doc.name,
              conversationTimestamp: doc.conversationTimestamp,
              unreadCount: doc.unreadCount
            }
          })
          return result
        } catch (e) {
          console.error('[MONGO] Get all chats error:', e.message)
          return {}
        }
      },

      async deleteChat(jid) {
        try {
          await Chat.deleteOne({ jid })
        } catch (e) {
          console.error('[MONGO] Delete chat error:', e.message)
        }
      },

      async saveSetting(chatId, key, value) {
        try {
          await Setting.updateOne(
            { chatId, key },
            { chatId, key, value, ts: Date.now() },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Save setting error:', e.message)
        }
      },

      async getSetting(chatId, key) {
        try {
          const doc = await Setting.findOne({ chatId, key })
          return doc ? doc.value : null
        } catch (e) {
          console.error('[MONGO] Get setting error:', e.message)
          return null
        }
      },

      async getAllSettings(chatId) {
        try {
          const docs = await Setting.find({ chatId })
          const result = {}
          docs.forEach(doc => {
            result[doc.key] = doc.value
          })
          return result
        } catch (e) {
          console.error('[MONGO] Get all settings error:', e.message)
          return {}
        }
      },

      async touchUser(jid, pushName = '') {
        try {
          const now = Date.now()
          await User.updateOne(
            { jid },
            {
              $setOnInsert: { jid, firstSeen: now, banned: false, premium: false },
              $set: { lastSeen: now },
              $inc: { messageCount: 1 }
            },
            { upsert: true }
          )

          if (pushName) {
            await UserInfo.updateOne(
              { jid },
              {
                $set: {
                  jid,
                  pushName,
                  displayName: pushName,
                  ts: now
                }
              },
              { upsert: true }
            )
          }
        } catch (e) {
          console.error('[MONGO] Touch user error:', e.message)
        }
      },

      async upsertUserInfo(jid, info = {}) {
        try {
          await UserInfo.updateOne(
            { jid },
            {
              $set: {
                jid,
                pushName: info.pushName || '',
                displayName: info.displayName || info.pushName || '',
                extras: info.extras || {},
                ts: Date.now()
              }
            },
            { upsert: true }
          )
        } catch (e) {
          console.error('[MONGO] Upsert user info error:', e.message)
        }
      },

      async replaceOwnerJids(jids = [], source = 'settings') {
        try {
          await OwnerJid.deleteMany({})
          if (!jids.length) return

          const now = Date.now()
          await OwnerJid.insertMany(
            jids.map(jid => ({ jid, source, ts: now })),
            { ordered: false }
          )
        } catch (e) {
          console.error('[MONGO] Replace owner JIDs error:', e.message)
        }
      },

      async getOwnerJids() {
        try {
          const docs = await OwnerJid.find({}, { jid: 1, _id: 0 })
          return docs.map(doc => doc.jid)
        } catch (e) {
          console.error('[MONGO] Get owner JIDs error:', e.message)
          return []
        }
      },

      async setPluginDisabled(name, disabled = true, reason = '') {
        try {
          if (!name) return
          if (disabled) {
            await DisabledPlugin.updateOne(
              { name },
              { $set: { name, reason, ts: Date.now() } },
              { upsert: true }
            )
          } else {
            await DisabledPlugin.deleteOne({ name })
          }
        } catch (e) {
          console.error('[MONGO] Set disabled plugin error:', e.message)
        }
      },

      async getDisabledPlugins() {
        try {
          const docs = await DisabledPlugin.find({}, { name: 1, _id: 0 })
          return docs.map(doc => doc.name)
        } catch (e) {
          console.error('[MONGO] Get disabled plugins error:', e.message)
          return []
        }
      },

      async cleanup() {
        try {
          const result = await Msg.deleteMany({ ts: { $lt: Date.now() - TTL_MS } })
          if (result.deletedCount > 0) {
            console.log(`[MONGO] Cleaned up ${result.deletedCount} old messages`)
          }
        } catch (e) {
          console.error('[MONGO] Cleanup error:', e.message)
        }
      },

      async close() {
        try {
          await mongoose.connection.close()
          console.log('[MONGO] Connection closed')
        } catch (e) {
          console.error('[MONGO] Close error:', e.message)
        }
      }
    }

    backend = 'mongo'
    messageLimit = MESSAGE_LIMITS.mongo
    printLog('store', 'MongoDB enabled - Unlimited message storage with full data persistence')
  } catch (e) {
    printLog('warning', `MongoDB initialization failed: ${e.message}`)
  }
}

/**
* ----------------- PostgreSQL -----------------
*/

if (backend === 'memory' && POSTGRES_URL) {
  try {
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      min: 2,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    })

    pool.on('error', (err) => {
      printLog('error', `PostgreSQL pool error: ${err.message}`)
    })

    adapters.postgres = {
      initialized: false,
      initPromise: null,

      async init() {
        if (this.initialized) return
        if (this.initPromise) return this.initPromise

        this.initPromise = (async () => {
          try {
            const client = await pool.connect()
            try {
              await client.query(`
                CREATE TABLE IF NOT EXISTS messages (
                  jid TEXT NOT NULL,
                  id TEXT PRIMARY KEY,
                  ts BIGINT NOT NULL,
                  data BYTEA NOT NULL
                )
              `)
              await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_jid ON messages(jid)`)
              await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts)`)

              await client.query(`
                CREATE TABLE IF NOT EXISTS message_counts (
                  chat_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  count INTEGER DEFAULT 0,
                  PRIMARY KEY (chat_id, user_id)
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS metadata (
                  key TEXT PRIMARY KEY,
                  value TEXT
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS contacts (
                  jid TEXT PRIMARY KEY,
                  name TEXT,
                  notify TEXT,
                  verified_name TEXT,
                  ts BIGINT NOT NULL
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS chats (
                  jid TEXT PRIMARY KEY,
                  name TEXT,
                  conversation_timestamp BIGINT,
                  unread_count INTEGER DEFAULT 0,
                  ts BIGINT NOT NULL
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                  chat_id TEXT NOT NULL,
                  key TEXT NOT NULL,
                  value TEXT,
                  ts BIGINT NOT NULL,
                  PRIMARY KEY (chat_id, key)
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                  jid TEXT PRIMARY KEY,
                  first_seen BIGINT NOT NULL,
                  last_seen BIGINT NOT NULL,
                  message_count INTEGER DEFAULT 0,
                  banned BOOLEAN DEFAULT FALSE,
                  premium BOOLEAN DEFAULT FALSE
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS user_infos (
                  jid TEXT PRIMARY KEY,
                  push_name TEXT,
                  display_name TEXT,
                  extras TEXT,
                  ts BIGINT NOT NULL
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS owner_jids (
                  jid TEXT PRIMARY KEY,
                  source TEXT,
                  ts BIGINT NOT NULL
                )
              `)

              await client.query(`
                CREATE TABLE IF NOT EXISTS disabled_plugins (
                  name TEXT PRIMARY KEY,
                  reason TEXT,
                  ts BIGINT NOT NULL
                )
              `)

              this.initialized = true
              printLog('store', 'PostgreSQL connected and tables ready')
            } finally {
              client.release()
            }
          } catch (e) {
            printLog('error', `PostgreSQL init error: ${e.message}`)
            this.initPromise = null
            throw e
          }
        })()

        return this.initPromise
      },

      async save(jid, id, msg) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO messages(jid,id,ts,data) VALUES($1,$2,$3,$4)
               ON CONFLICT (id) DO UPDATE SET data=$4, ts=$3`,
              [jid, id, Date.now(), compress(msg)]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error(`[POSTGRES] Save error:`, e.message)
        }
      },

      async load(jid, id) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(
              `SELECT data FROM messages WHERE jid=$1 AND id=$2`,
              [jid, id]
            )
            return res.rows[0] ? decompress(res.rows[0].data) : null
          } finally {
            client.release()
          }
        } catch (e) {
          console.error(`[POSTGRES] Load error:`, e.message)
          return null
        }
      },

      async incrementCount(chatId, userId) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO message_counts(chat_id, user_id, count) VALUES($1,$2,1)
               ON CONFLICT (chat_id, user_id) DO UPDATE SET count = message_counts.count + 1`,
              [chatId, userId]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Increment count error:', e.message)
        }
      },

      async getCount(chatId, userId) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(
              `SELECT count FROM message_counts WHERE chat_id=$1 AND user_id=$2`,
              [chatId, userId]
            )
            return res.rows[0] ? res.rows[0].count : 0
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get count error:', e.message)
          return 0
        }
      },

      async getAllCounts() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT chat_id, user_id, count FROM message_counts`)
            const result = { isPublic: true, messageCount: {} }
            res.rows.forEach(row => {
              if (!result.messageCount[row.chat_id]) {
                result.messageCount[row.chat_id] = {}
              }
              result.messageCount[row.chat_id][row.user_id] = row.count
            })
            const metaRes = await client.query(`SELECT value FROM metadata WHERE key='isPublic'`)
            if (metaRes.rows[0]) result.isPublic = metaRes.rows[0].value === 'true'
            return result
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get all counts error:', e.message)
          return { isPublic: true, messageCount: {} }
        }
      },

      async setPublicMode(isPublic) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO metadata(key, value) VALUES('isPublic', $1)
               ON CONFLICT (key) DO UPDATE SET value=$1`,
              [isPublic.toString()]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Set public mode error:', e.message)
        }
      },

      async setMetadata(key, value) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO metadata(key, value) VALUES($1, $2)
               ON CONFLICT (key) DO UPDATE SET value=$2`,
              [key, value.toString()]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error(`[POSTGRES] Set metadata error:`, e.message)
        }
      },

      async getMetadata(key) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT value FROM metadata WHERE key=$1`, [key])
            return res.rows[0] ? res.rows[0].value : null
          } finally {
            client.release()
          }
        } catch (e) {
          console.error(`[POSTGRES] Get metadata error:`, e.message)
          return null
        }
      },

      async saveContact(jid, contact) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO contacts(jid, name, notify, verified_name, ts) VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (jid) DO UPDATE SET name=$2, notify=$3, verified_name=$4, ts=$5`,
              [jid, contact.name || '', contact.notify || '', contact.verifiedName || '', Date.now()]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Save contact error:', e.message)
        }
      },

      async getContact(jid) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT * FROM contacts WHERE jid=$1`, [jid])
            return res.rows[0] || null
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get contact error:', e.message)
          return null
        }
      },

      async getAllContacts() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT jid, name, notify FROM contacts`)
            const result = {}
            res.rows.forEach(row => {
              result[row.jid] = { id: row.jid, name: row.name, notify: row.notify }
            })
            return result
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get all contacts error:', e.message)
          return {}
        }
      },

      async saveChat(jid, chat) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO chats(jid, name, conversation_timestamp, unread_count, ts) VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (jid) DO UPDATE SET name=$2, conversation_timestamp=$3, unread_count=$4, ts=$5`,
              [jid, chat.name || '', chat.conversationTimestamp || 0, chat.unreadCount || 0, Date.now()]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Save chat error:', e.message)
        }
      },

      async getChat(jid) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT * FROM chats WHERE jid=$1`, [jid])
            return res.rows[0] || null
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get chat error:', e.message)
          return null
        }
      },

      async getAllChats() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT * FROM chats`)
            const result = {}
            res.rows.forEach(row => {
              result[row.jid] = {
                id: row.jid,
                name: row.name,
                conversationTimestamp: row.conversation_timestamp,
                unreadCount: row.unread_count
              }
            })
            return result
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get all chats error:', e.message)
          return {}
        }
      },

      async deleteChat(jid) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(`DELETE FROM chats WHERE jid=$1`, [jid])
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Delete chat error:', e.message)
        }
      },

      async saveSetting(chatId, key, value) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query(
              `INSERT INTO settings(chat_id, key, value, ts) VALUES($1, $2, $3, $4)
               ON CONFLICT (chat_id, key) DO UPDATE SET value=$3, ts=$4`,
              [chatId, key, JSON.stringify(value), Date.now()]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Save setting error:', e.message)
        }
      },

      async getSetting(chatId, key) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(
              `SELECT value FROM settings WHERE chat_id=$1 AND key=$2`,
              [chatId, key]
            )
            return res.rows[0] ? JSON.parse(res.rows[0].value) : null
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get setting error:', e.message)
          return null
        }
      },

      async getAllSettings(chatId) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT key, value FROM settings WHERE chat_id=$1`, [chatId])
            const result = {}
            res.rows.forEach(row => {
              result[row.key] = JSON.parse(row.value)
            })
            return result
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get all settings error:', e.message)
          return {}
        }
      },

      async touchUser(jid, pushName = '') {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const now = Date.now()
            await client.query(
              `INSERT INTO users(jid, first_seen, last_seen, message_count, banned, premium)
               VALUES($1, $2, $2, 1, FALSE, FALSE)
               ON CONFLICT (jid) DO UPDATE SET
                 last_seen=EXCLUDED.last_seen,
                 message_count=users.message_count + 1`,
              [jid, now]
            )

            if (pushName) {
              await client.query(
                `INSERT INTO user_infos(jid, push_name, display_name, extras, ts)
                 VALUES($1, $2, $2, $3, $4)
                 ON CONFLICT (jid) DO UPDATE SET push_name=$2, display_name=$2, ts=$4`,
                [jid, pushName, '{}', now]
              )
            }
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Touch user error:', e.message)
        }
      },

      async upsertUserInfo(jid, info = {}) {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const now = Date.now()
            await client.query(
              `INSERT INTO user_infos(jid, push_name, display_name, extras, ts)
               VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (jid) DO UPDATE SET push_name=$2, display_name=$3, extras=$4, ts=$5`,
              [
                jid,
                info.pushName || '',
                info.displayName || info.pushName || '',
                JSON.stringify(info.extras || {}),
                now
              ]
            )
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Upsert user info error:', e.message)
        }
      },

      async replaceOwnerJids(jids = [], source = 'settings') {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            await client.query(`DELETE FROM owner_jids`)
            const now = Date.now()
            for (const jid of jids) {
              await client.query(
                `INSERT INTO owner_jids(jid, source, ts) VALUES($1, $2, $3)
                 ON CONFLICT (jid) DO UPDATE SET source=$2, ts=$3`,
                [jid, source, now]
              )
            }
            await client.query('COMMIT')
          } catch (err) {
            try { await client.query('ROLLBACK') } catch {}
            throw err
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Replace owner JIDs error:', e.message)
        }
      },

      async getOwnerJids() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT jid FROM owner_jids`)
            return res.rows.map(row => row.jid)
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get owner JIDs error:', e.message)
          return []
        }
      },

      async setPluginDisabled(name, disabled = true, reason = '') {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            if (!name) return
            if (disabled) {
              await client.query(
                `INSERT INTO disabled_plugins(name, reason, ts) VALUES($1, $2, $3)
                 ON CONFLICT (name) DO UPDATE SET reason=$2, ts=$3`,
                [name, reason, Date.now()]
              )
            } else {
              await client.query(`DELETE FROM disabled_plugins WHERE name=$1`, [name])
            }
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Set disabled plugin error:', e.message)
        }
      },

      async getDisabledPlugins() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(`SELECT name FROM disabled_plugins`)
            return res.rows.map(row => row.name)
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Get disabled plugins error:', e.message)
          return []
        }
      },

      async cleanup() {
        try {
          await this.init()
          const client = await pool.connect()
          try {
            const res = await client.query(
              `DELETE FROM messages WHERE ts < $1`,
              [Date.now() - TTL_MS]
            )
            if (res.rowCount > 0) {
              console.log(`[POSTGRES] Cleaned up ${res.rowCount} old messages`)
            }
          } finally {
            client.release()
          }
        } catch (e) {
          console.error('[POSTGRES] Cleanup error:', e.message)
        }
      },

      async close() {
        try {
          await pool.end()
          console.log('[POSTGRES] Pool closed')
        } catch (e) {
          console.error('[POSTGRES] Close error:', e.message)
        }
      }
    }

    backend = 'postgres'
    messageLimit = MESSAGE_LIMITS.postgres
    printLog('store', 'PostgreSQL enabled - Unlimited message storage with full data persistence')
  } catch (e) {
    printLog('warning', `PostgreSQL initialization failed: ${e.message}`)
  }
}

/**
 * ----------------- MySQL -----------------
*/

if (backend === 'memory' && MYSQL_URL) {
  try {
    const mysql = require('mysql2/promise')
    let mysqlConn = null
    let connectPromise = null
    let connectionAttempts = 0
    let connectionFailed = false
    const MAX_RETRIES = 3

    adapters.mysql = {
      async getConn() {
        if (connectionFailed) {
          throw new Error('MySQL connection permanently failed after multiple attempts')
        }

        if (mysqlConn) return mysqlConn
        if (connectPromise) return connectPromise

        if (connectionAttempts >= MAX_RETRIES) {
          connectionFailed = true
          printLog('error', 'MySQL: Max connection attempts reached, disabling MySQL adapter')
          throw new Error('Max MySQL connection attempts reached')
        }

        connectPromise = (async () => {
          try {
            connectionAttempts++
            mysqlConn = await mysql.createConnection(MYSQL_URL)

            // Create all tables
            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS messages (
                jid VARCHAR(255) NOT NULL,
                id VARCHAR(255) PRIMARY KEY,
                ts BIGINT NOT NULL,
                data LONGBLOB NOT NULL,
                INDEX idx_jid (jid),
                INDEX idx_ts (ts)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS message_counts (
                chat_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                count INT DEFAULT 0,
                PRIMARY KEY (chat_id, user_id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS metadata (
                \`key\` VARCHAR(255) PRIMARY KEY,
                value TEXT
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS contacts (
                jid VARCHAR(255) PRIMARY KEY,
                name TEXT,
                notify TEXT,
                verified_name TEXT,
                ts BIGINT NOT NULL
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS chats (
                jid VARCHAR(255) PRIMARY KEY,
                name TEXT,
                conversation_timestamp BIGINT,
                unread_count INT DEFAULT 0,
                ts BIGINT NOT NULL
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS settings (
                chat_id VARCHAR(255) NOT NULL,
                \`key\` VARCHAR(255) NOT NULL,
                value TEXT,
                ts BIGINT NOT NULL,
                PRIMARY KEY (chat_id, \`key\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS users (
                jid VARCHAR(255) PRIMARY KEY,
                first_seen BIGINT NOT NULL,
                last_seen BIGINT NOT NULL,
                message_count INT DEFAULT 0,
                banned TINYINT(1) DEFAULT 0,
                premium TINYINT(1) DEFAULT 0
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS user_infos (
                jid VARCHAR(255) PRIMARY KEY,
                push_name TEXT,
                display_name TEXT,
                extras TEXT,
                ts BIGINT NOT NULL
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS owner_jids (
                jid VARCHAR(255) PRIMARY KEY,
                source VARCHAR(255),
                ts BIGINT NOT NULL
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            await mysqlConn.execute(`
              CREATE TABLE IF NOT EXISTS disabled_plugins (
                name VARCHAR(255) PRIMARY KEY,
                reason TEXT,
                ts BIGINT NOT NULL
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `)

            printLog('store', 'MySQL connection established and tables ready')
            return mysqlConn
          } catch (e) {
            printLog('error', `MySQL connection error: ${e.message}`)
            connectPromise = null
            mysqlConn = null
            throw e
          }
        })()

        return connectPromise
      },

      async save(jid, id, msg) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO messages(jid,id,ts,data) VALUES(?,?,?,?)
             ON DUPLICATE KEY UPDATE data=VALUES(data), ts=VALUES(ts)`,
            [jid, id, Date.now(), compress(msg)]
          )
        } catch (e) {
          console.error(`[MYSQL] Save error:`, e.message)
        }
      },

      async load(jid, id) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(
            `SELECT data FROM messages WHERE jid=? AND id=?`,
            [jid, id]
          )
          return rows[0] ? decompress(rows[0].data) : null
        } catch (e) {
          console.error(`[MYSQL] Load error:`, e.message)
          return null
        }
      },

      async incrementCount(chatId, userId) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO message_counts(chat_id, user_id, count) VALUES(?,?,1)
             ON DUPLICATE KEY UPDATE count = count + 1`,
            [chatId, userId]
          )
        } catch (e) {
          console.error('[MYSQL] Increment count error:', e.message)
        }
      },

      async getCount(chatId, userId) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(
            `SELECT count FROM message_counts WHERE chat_id=? AND user_id=?`,
            [chatId, userId]
          )
          return rows[0] ? rows[0].count : 0
        } catch (e) {
          console.error('[MYSQL] Get count error:', e.message)
          return 0
        }
      },

      async getAllCounts() {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT chat_id, user_id, count FROM message_counts`)
          const result = { isPublic: true, messageCount: {} }
          rows.forEach(row => {
            if (!result.messageCount[row.chat_id]) {
              result.messageCount[row.chat_id] = {}
            }
            result.messageCount[row.chat_id][row.user_id] = row.count
          })
          const [metaRows] = await conn.execute(`SELECT value FROM metadata WHERE \`key\`='isPublic'`)
          if (metaRows[0]) result.isPublic = metaRows[0].value === 'true'
          return result
        } catch (e) {
          console.error('[MYSQL] Get all counts error:', e.message)
          return { isPublic: true, messageCount: {} }
        }
      },

      async setPublicMode(isPublic) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO metadata(\`key\`, value) VALUES('isPublic', ?)
             ON DUPLICATE KEY UPDATE value=VALUES(value)`,
            [isPublic.toString()]
          )
        } catch (e) {
          console.error('[MYSQL] Set public mode error:', e.message)
        }
      },

      async setMetadata(key, value) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO metadata(\`key\`, value) VALUES(?, ?)
             ON DUPLICATE KEY UPDATE value=VALUES(value)`,
            [key, value.toString()]
          )
        } catch (e) {
          console.error(`[MYSQL] Set metadata error:`, e.message)
        }
      },

      async getMetadata(key) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT value FROM metadata WHERE \`key\`=?`, [key])
          return rows[0] ? rows[0].value : null
        } catch (e) {
          console.error(`[MYSQL] Get metadata error:`, e.message)
          return null
        }
      },

      async saveContact(jid, contact) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO contacts(jid, name, notify, verified_name, ts) VALUES(?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), notify=VALUES(notify), verified_name=VALUES(verified_name), ts=VALUES(ts)`,
            [jid, contact.name || '', contact.notify || '', contact.verifiedName || '', Date.now()]
          )
        } catch (e) {
          console.error('[MYSQL] Save contact error:', e.message)
        }
      },

      async getContact(jid) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT * FROM contacts WHERE jid=?`, [jid])
          return rows[0] || null
        } catch (e) {
          console.error('[MYSQL] Get contact error:', e.message)
          return null
        }
      },

      async getAllContacts() {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT jid, name, notify FROM contacts`)
          const result = {}
          rows.forEach(row => {
            result[row.jid] = { id: row.jid, name: row.name, notify: row.notify }
          })
          return result
        } catch (e) {
          console.error('[MYSQL] Get all contacts error:', e.message)
          return {}
        }
      },

      async saveChat(jid, chat) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO chats(jid, name, conversation_timestamp, unread_count, ts) VALUES(?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), conversation_timestamp=VALUES(conversation_timestamp), unread_count=VALUES(unread_count), ts=VALUES(ts)`,
            [jid, chat.name || '', chat.conversationTimestamp || 0, chat.unreadCount || 0, Date.now()]
          )
        } catch (e) {
          console.error('[MYSQL] Save chat error:', e.message)
        }
      },

      async getChat(jid) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT * FROM chats WHERE jid=?`, [jid])
          return rows[0] || null
        } catch (e) {
          console.error('[MYSQL] Get chat error:', e.message)
          return null
        }
      },

      async getAllChats() {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT * FROM chats`)
          const result = {}
          rows.forEach(row => {
            result[row.jid] = {
              id: row.jid,
              name: row.name,
              conversationTimestamp: row.conversation_timestamp,
              unreadCount: row.unread_count
            }
          })
          return result
        } catch (e) {
          console.error('[MYSQL] Get all chats error:', e.message)
          return {}
        }
      },

      async deleteChat(jid) {
        try {
          const conn = await this.getConn()
          await conn.execute(`DELETE FROM chats WHERE jid=?`, [jid])
        } catch (e) {
          console.error('[MYSQL] Delete chat error:', e.message)
        }
      },

      async saveSetting(chatId, key, value) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO settings(chat_id, \`key\`, value, ts) VALUES(?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE value=VALUES(value), ts=VALUES(ts)`,
            [chatId, key, JSON.stringify(value), Date.now()]
          )
        } catch (e) {
          console.error('[MYSQL] Save setting error:', e.message)
        }
      },

      async getSetting(chatId, key) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(
            `SELECT value FROM settings WHERE chat_id=? AND \`key\`=?`,
            [chatId, key]
          )
          return rows[0] ? JSON.parse(rows[0].value) : null
        } catch (e) {
          console.error('[MYSQL] Get setting error:', e.message)
          return null
        }
      },

      async getAllSettings(chatId) {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT \`key\`, value FROM settings WHERE chat_id=?`, [chatId])
          const result = {}
          rows.forEach(row => {
            result[row.key] = JSON.parse(row.value)
          })
          return result
        } catch (e) {
          console.error('[MYSQL] Get all settings error:', e.message)
          return {}
        }
      },

      async touchUser(jid, pushName = '') {
        try {
          const conn = await this.getConn()
          const now = Date.now()
          await conn.execute(
            `INSERT INTO users(jid, first_seen, last_seen, message_count, banned, premium)
             VALUES(?, ?, ?, 1, 0, 0)
             ON DUPLICATE KEY UPDATE last_seen=VALUES(last_seen), message_count=message_count + 1`,
            [jid, now, now]
          )

          if (pushName) {
            await conn.execute(
              `INSERT INTO user_infos(jid, push_name, display_name, extras, ts)
               VALUES(?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE push_name=VALUES(push_name), display_name=VALUES(display_name), ts=VALUES(ts)`,
              [jid, pushName, pushName, '{}', now]
            )
          }
        } catch (e) {
          console.error('[MYSQL] Touch user error:', e.message)
        }
      },

      async upsertUserInfo(jid, info = {}) {
        try {
          const conn = await this.getConn()
          await conn.execute(
            `INSERT INTO user_infos(jid, push_name, display_name, extras, ts)
             VALUES(?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE push_name=VALUES(push_name), display_name=VALUES(display_name), extras=VALUES(extras), ts=VALUES(ts)`,
            [
              jid,
              info.pushName || '',
              info.displayName || info.pushName || '',
              JSON.stringify(info.extras || {}),
              Date.now()
            ]
          )
        } catch (e) {
          console.error('[MYSQL] Upsert user info error:', e.message)
        }
      },

      async replaceOwnerJids(jids = [], source = 'settings') {
        try {
          const conn = await this.getConn()
          await conn.execute(`DELETE FROM owner_jids`)
          const now = Date.now()
          for (const jid of jids) {
            await conn.execute(
              `INSERT INTO owner_jids(jid, source, ts) VALUES(?, ?, ?)
               ON DUPLICATE KEY UPDATE source=VALUES(source), ts=VALUES(ts)`,
              [jid, source, now]
            )
          }
        } catch (e) {
          console.error('[MYSQL] Replace owner JIDs error:', e.message)
        }
      },

      async getOwnerJids() {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT jid FROM owner_jids`)
          return rows.map(row => row.jid)
        } catch (e) {
          console.error('[MYSQL] Get owner JIDs error:', e.message)
          return []
        }
      },

      async setPluginDisabled(name, disabled = true, reason = '') {
        try {
          if (!name) return
          const conn = await this.getConn()
          if (disabled) {
            await conn.execute(
              `INSERT INTO disabled_plugins(name, reason, ts) VALUES(?, ?, ?)
               ON DUPLICATE KEY UPDATE reason=VALUES(reason), ts=VALUES(ts)`,
              [name, reason, Date.now()]
            )
          } else {
            await conn.execute(`DELETE FROM disabled_plugins WHERE name=?`, [name])
          }
        } catch (e) {
          console.error('[MYSQL] Set disabled plugin error:', e.message)
        }
      },

      async getDisabledPlugins() {
        try {
          const conn = await this.getConn()
          const [rows] = await conn.execute(`SELECT name FROM disabled_plugins`)
          return rows.map(row => row.name)
        } catch (e) {
          console.error('[MYSQL] Get disabled plugins error:', e.message)
          return []
        }
      },

      async cleanup() {
        try {
          const conn = await this.getConn()
          const [result] = await conn.execute(
            `DELETE FROM messages WHERE ts < ?`,
            [Date.now() - TTL_MS]
          )
          if (result.affectedRows > 0) {
            console.log(`[MYSQL] Cleaned up ${result.affectedRows} old messages`)
          }
        } catch (e) {
          console.error('[MYSQL] Cleanup error:', e.message)
        }
      },

      async close() {
        try {
          if (mysqlConn) {
            await mysqlConn.end()
            mysqlConn = null
            console.log('[MYSQL] Connection closed')
          }
        } catch (e) {
          console.error('[MYSQL] Close error:', e.message)
        }
      }
    }

    backend = 'mysql'
    messageLimit = MESSAGE_LIMITS.mysql
    printLog('store', 'MySQL enabled - Unlimited message storage with full data persistence')
  } catch (e) {
    printLog('warning', `MySQL initialization failed: ${e.message}`)
  }
}

/**
* ----------------- SQLite -----------------
*/

if (backend === 'memory') {
  try {
    const Database = require('better-sqlite3')
    const dir = path.dirname(SQLITE_URL)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const sqlite = new Database(SQLITE_URL)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('synchronous = NORMAL')
    sqlite.pragma('cache_size = -64000')
    sqlite.pragma('temp_store = MEMORY')

    // Create all tables
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS messages (
        jid TEXT NOT NULL,
        id TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        data BLOB NOT NULL
      )
    `).run()

    sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_jid ON messages(jid)`).run()
    sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts)`).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS message_counts (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (chat_id, user_id)
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS contacts (
        jid TEXT PRIMARY KEY,
        name TEXT,
        notify TEXT,
        verified_name TEXT,
        ts INTEGER NOT NULL
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS chats (
        jid TEXT PRIMARY KEY,
        name TEXT,
        conversation_timestamp INTEGER,
        unread_count INTEGER DEFAULT 0,
        ts INTEGER NOT NULL
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        chat_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        ts INTEGER NOT NULL,
        PRIMARY KEY (chat_id, key)
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        jid TEXT PRIMARY KEY,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        banned INTEGER DEFAULT 0,
        premium INTEGER DEFAULT 0
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS user_infos (
        jid TEXT PRIMARY KEY,
        push_name TEXT,
        display_name TEXT,
        extras TEXT,
        ts INTEGER NOT NULL
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS owner_jids (
        jid TEXT PRIMARY KEY,
        source TEXT,
        ts INTEGER NOT NULL
      )
    `).run()

    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS disabled_plugins (
        name TEXT PRIMARY KEY,
        reason TEXT,
        ts INTEGER NOT NULL
      )
    `).run()

    const saveStmt = sqlite.prepare(`INSERT OR REPLACE INTO messages VALUES (?,?,?,?)`)
    const loadStmt = sqlite.prepare(`SELECT data FROM messages WHERE jid=? AND id=?`)
    const cleanupStmt = sqlite.prepare(`DELETE FROM messages WHERE ts < ?`)
    const countStmt = sqlite.prepare(`SELECT COUNT(*) as count FROM messages WHERE jid=?`)
    const deleteOldestStmt = sqlite.prepare(`
      DELETE FROM messages WHERE jid=? AND id IN (
        SELECT id FROM messages WHERE jid=? ORDER BY ts ASC LIMIT ?
      )
    `)

    const incrementCountStmt = sqlite.prepare(`
      INSERT INTO message_counts(chat_id, user_id, count) VALUES(?,?,1)
      ON CONFLICT(chat_id, user_id) DO UPDATE SET count = count + 1
    `)
    const getCountStmt = sqlite.prepare(`SELECT count FROM message_counts WHERE chat_id=? AND user_id=?`)
    const getAllCountsStmt = sqlite.prepare(`SELECT chat_id, user_id, count FROM message_counts`)
    const getMetaStmt = sqlite.prepare(`SELECT value FROM metadata WHERE key='isPublic'`)
    const setMetaStmt = sqlite.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES('isPublic', ?)`)
    const getMetadataStmt = sqlite.prepare(`SELECT value FROM metadata WHERE key=?`)
    const setMetadataStmt = sqlite.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES(?, ?)`)

    const saveContactStmt = sqlite.prepare(`INSERT OR REPLACE INTO contacts(jid, name, notify, verified_name, ts) VALUES(?, ?, ?, ?, ?)`)
    const getContactStmt = sqlite.prepare(`SELECT * FROM contacts WHERE jid=?`)
    const getAllContactsStmt = sqlite.prepare(`SELECT jid, name, notify FROM contacts`)

    const saveChatStmt = sqlite.prepare(`INSERT OR REPLACE INTO chats(jid, name, conversation_timestamp, unread_count, ts) VALUES(?, ?, ?, ?, ?)`)
    const getChatStmt = sqlite.prepare(`SELECT * FROM chats WHERE jid=?`)
    const getAllChatsStmt = sqlite.prepare(`SELECT * FROM chats`)
    const deleteChatStmt = sqlite.prepare(`DELETE FROM chats WHERE jid=?`)

    const saveSettingStmt = sqlite.prepare(`INSERT OR REPLACE INTO settings(chat_id, key, value, ts) VALUES(?, ?, ?, ?)`)
    const getSettingStmt = sqlite.prepare(`SELECT value FROM settings WHERE chat_id=? AND key=?`)
    const getAllSettingsStmt = sqlite.prepare(`SELECT key, value FROM settings WHERE chat_id=?`)

    const touchUserStmt = sqlite.prepare(`
      INSERT INTO users(jid, first_seen, last_seen, message_count, banned, premium) VALUES(?, ?, ?, 1, 0, 0)
      ON CONFLICT(jid) DO UPDATE SET last_seen=excluded.last_seen, message_count=users.message_count + 1
    `)
    const upsertUserInfoStmt = sqlite.prepare(`
      INSERT INTO user_infos(jid, push_name, display_name, extras, ts) VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(jid) DO UPDATE SET push_name=excluded.push_name, display_name=excluded.display_name, extras=excluded.extras, ts=excluded.ts
    `)
    const clearOwnerJidsStmt = sqlite.prepare(`DELETE FROM owner_jids`)
    const saveOwnerJidStmt = sqlite.prepare(`INSERT OR REPLACE INTO owner_jids(jid, source, ts) VALUES(?, ?, ?)`)
    const getOwnerJidsStmt = sqlite.prepare(`SELECT jid FROM owner_jids`)
    const setDisabledPluginStmt = sqlite.prepare(`INSERT OR REPLACE INTO disabled_plugins(name, reason, ts) VALUES(?, ?, ?)`)
    const removeDisabledPluginStmt = sqlite.prepare(`DELETE FROM disabled_plugins WHERE name=?`)
    const getDisabledPluginsStmt = sqlite.prepare(`SELECT name FROM disabled_plugins`)

    adapters.sqlite = {
      save(jid, id, msg) {
        try {
          saveStmt.run(jid, id, Date.now(), compress(msg))

          const { count } = countStmt.get(jid)
          if (count > MESSAGE_LIMITS.sqlite) {
            const toDelete = count - MESSAGE_LIMITS.sqlite
            deleteOldestStmt.run(jid, jid, toDelete)
          }
        } catch (e) {
          console.error(`[SQLITE] Save error:`, e.message)
        }
      },

      load(jid, id) {
        try {
          const row = loadStmt.get(jid, id)
          return row ? decompress(row.data) : null
        } catch (e) {
          console.error(`[SQLITE] Load error:`, e.message)
          return null
        }
      },

      incrementCount(chatId, userId) {
        try {
          incrementCountStmt.run(chatId, userId)
        } catch (e) {
          console.error('[SQLITE] Increment count error:', e.message)
        }
      },

      getCount(chatId, userId) {
        try {
          const row = getCountStmt.get(chatId, userId)
          return row ? row.count : 0
        } catch (e) {
          console.error('[SQLITE] Get count error:', e.message)
          return 0
        }
      },

      getAllCounts() {
        try {
          const rows = getAllCountsStmt.all()
          const result = { isPublic: true, messageCount: {} }
          rows.forEach(row => {
            if (!result.messageCount[row.chat_id]) {
              result.messageCount[row.chat_id] = {}
            }
            result.messageCount[row.chat_id][row.user_id] = row.count
          })
          const metaRow = getMetaStmt.get()
          if (metaRow) result.isPublic = metaRow.value === 'true'
          return result
        } catch (e) {
          console.error('[SQLITE] Get all counts error:', e.message)
          return { isPublic: true, messageCount: {} }
        }
      },

      setPublicMode(isPublic) {
        try {
          setMetaStmt.run(isPublic.toString())
        } catch (e) {
          console.error('[SQLITE] Set public mode error:', e.message)
        }
      },

      setMetadata(key, value) {
        try {
          setMetadataStmt.run(key, value.toString())
        } catch (e) {
          console.error(`[SQLITE] Set metadata error:`, e.message)
        }
      },

      getMetadata(key) {
        try {
          const row = getMetadataStmt.get(key)
          return row ? row.value : null
        } catch (e) {
          console.error(`[SQLITE] Get metadata error:`, e.message)
          return null
        }
      },

      saveContact(jid, contact) {
        try {
          saveContactStmt.run(jid, contact.name || '', contact.notify || '', contact.verifiedName || '', Date.now())
        } catch (e) {
          console.error('[SQLITE] Save contact error:', e.message)
        }
      },

      getContact(jid) {
        try {
          return getContactStmt.get(jid) || null
        } catch (e) {
          console.error('[SQLITE] Get contact error:', e.message)
          return null
        }
      },

      getAllContacts() {
        try {
          const rows = getAllContactsStmt.all()
          const result = {}
          rows.forEach(row => {
            result[row.jid] = { id: row.jid, name: row.name, notify: row.notify }
          })
          return result
        } catch (e) {
          console.error('[SQLITE] Get all contacts error:', e.message)
          return {}
        }
      },

      saveChat(jid, chat) {
        try {
          saveChatStmt.run(jid, chat.name || '', chat.conversationTimestamp || 0, chat.unreadCount || 0, Date.now())
        } catch (e) {
          console.error('[SQLITE] Save chat error:', e.message)
        }
      },

      getChat(jid) {
        try {
          return getChatStmt.get(jid) || null
        } catch (e) {
          console.error('[SQLITE] Get chat error:', e.message)
          return null
        }
      },

      getAllChats() {
        try {
          const rows = getAllChatsStmt.all()
          const result = {}
          rows.forEach(row => {
            result[row.jid] = {
              id: row.jid,
              name: row.name,
              conversationTimestamp: row.conversation_timestamp,
              unreadCount: row.unread_count
            }
          })
          return result
        } catch (e) {
          console.error('[SQLITE] Get all chats error:', e.message)
          return {}
        }
      },

      deleteChat(jid) {
        try {
          deleteChatStmt.run(jid)
        } catch (e) {
          console.error('[SQLITE] Delete chat error:', e.message)
        }
      },

      saveSetting(chatId, key, value) {
        try {
          saveSettingStmt.run(chatId, key, JSON.stringify(value), Date.now())
        } catch (e) {
          console.error('[SQLITE] Save setting error:', e.message)
        }
      },

      getSetting(chatId, key) {
        try {
          const row = getSettingStmt.get(chatId, key)
          return row ? JSON.parse(row.value) : null
        } catch (e) {
          console.error('[SQLITE] Get setting error:', e.message)
          return null
        }
      },

      getAllSettings(chatId) {
        try {
          const rows = getAllSettingsStmt.all(chatId)
          const result = {}
          rows.forEach(row => {
            result[row.key] = JSON.parse(row.value)
          })
          return result
        } catch (e) {
          console.error('[SQLITE] Get all settings error:', e.message)
          return {}
        }
      },

      touchUser(jid, pushName = '') {
        try {
          const now = Date.now()
          touchUserStmt.run(jid, now, now)
          if (pushName) {
            upsertUserInfoStmt.run(jid, pushName, pushName, '{}', now)
          }
        } catch (e) {
          console.error('[SQLITE] Touch user error:', e.message)
        }
      },

      upsertUserInfo(jid, info = {}) {
        try {
          upsertUserInfoStmt.run(
            jid,
            info.pushName || '',
            info.displayName || info.pushName || '',
            JSON.stringify(info.extras || {}),
            Date.now()
          )
        } catch (e) {
          console.error('[SQLITE] Upsert user info error:', e.message)
        }
      },

      replaceOwnerJids(jids = [], source = 'settings') {
        try {
          clearOwnerJidsStmt.run()
          const now = Date.now()
          for (const jid of jids) {
            saveOwnerJidStmt.run(jid, source, now)
          }
        } catch (e) {
          console.error('[SQLITE] Replace owner JIDs error:', e.message)
        }
      },

      getOwnerJids() {
        try {
          const rows = getOwnerJidsStmt.all()
          return rows.map(row => row.jid)
        } catch (e) {
          console.error('[SQLITE] Get owner JIDs error:', e.message)
          return []
        }
      },

      setPluginDisabled(name, disabled = true, reason = '') {
        try {
          if (!name) return
          if (disabled) {
            setDisabledPluginStmt.run(name, reason, Date.now())
          } else {
            removeDisabledPluginStmt.run(name)
          }
        } catch (e) {
          console.error('[SQLITE] Set disabled plugin error:', e.message)
        }
      },

      getDisabledPlugins() {
        try {
          const rows = getDisabledPluginsStmt.all()
          return rows.map(row => row.name)
        } catch (e) {
          console.error('[SQLITE] Get disabled plugins error:', e.message)
          return []
        }
      },

      cleanup() {
        try {
          const result = cleanupStmt.run(Date.now() - TTL_MS)
          if (result.changes > 0) {
            console.log(`[SQLITE] Cleaned up ${result.changes} old messages`)
          }
        } catch (e) {
          console.error('[SQLITE] Cleanup error:', e.message)
        }
      },

      close() {
        try {
          sqlite.close()
          console.log('[SQLITE] Database closed')
        } catch (e) {
          console.error('[SQLITE] Close error:', e.message)
        }
      }
    }

    backend = 'sqlite'
    messageLimit = MESSAGE_LIMITS.sqlite
    printLog('store', `SQLite enabled - Max ${MESSAGE_LIMITS.sqlite} messages per chat with full data persistence`)
  } catch (e) {
    printLog('warning', `SQLite initialization failed: ${e.message}`)
  }
}

/**
* STORE OBJECT (MAIN)
*/

const store = {
  messages: {},
  contacts: {},
  chats: {},
  messageCount: {},
  isPublic: true,
  botMode: 'public',

  async readFromFile(filePath = STORE_FILE) {
    try {
      if (backend !== 'memory') {
        const contacts = await adapters[backend].getAllContacts()
        const chats = await adapters[backend].getAllChats()
        const mode = await this.getBotMode()

        this.contacts = contacts
        this.chats = chats
        this.botMode = mode

        console.log('[STORE] Loaded data from database')
      } else {
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          this.contacts = data.contacts || {}
          this.chats = data.chats || {}
          this.botMode = data.botMode || 'public'
          // Skip loading old messages - start fresh every boot
          // this.messages = data.messages || {}
          this.messages = {}
          this.cleanupData()
          console.log('[STORE] Loaded from file (memory mode, fresh messages)')
        }
      }
    } catch (e) {
      console.warn('[STORE] Failed to read store file:', e.message)
    }

    await this.loadMessageCounts()
  },

  isWriting: false,

  async writeToFile(filePath = STORE_FILE) {
    try {
      if (backend !== 'memory') {
        return
      }

      if (this.isWriting) return;
      this.isWriting = true;

      const data = {
        contacts: this.contacts,
        chats: this.chats,
        botMode: this.botMode || 'public',
        messages: this.messages
      }

      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('[STORE] Failed to write store file:', e.message)
    } finally {
      this.isWriting = false;
    }

    await this.saveMessageCounts()
  },

  async loadMessageCounts() {
    if (backend === 'memory') {
      try {
        if (fs.existsSync(MESSAGE_COUNT_FILE)) {
          const data = JSON.parse(fs.readFileSync(MESSAGE_COUNT_FILE, 'utf-8'))
          this.messageCount = data.messageCount || data
          this.isPublic = typeof data.isPublic === 'boolean' ? data.isPublic : true
          console.log('[STORE] Loaded message counts from file')
        }
      } catch (e) {
        console.warn('[STORE] Failed to read message count file:', e.message)
      }
    }
  },

  async saveMessageCounts() {
    if (backend === 'memory') {
      try {
        const dir = path.dirname(MESSAGE_COUNT_FILE)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

        const data = {
          isPublic: this.isPublic,
          messageCount: this.messageCount
        }
        await fs.promises.writeFile(MESSAGE_COUNT_FILE, JSON.stringify(data, null, 2))
      } catch (e) {
        console.warn('[STORE] Failed to write message count file:', e.message)
      }
    }
  },

  cleanupData() {
    if (this.messages && backend === 'memory') {
      Object.keys(this.messages).forEach(jid => {
        if (typeof this.messages[jid] === 'object' && !Array.isArray(this.messages[jid])) {
          const messages = Object.values(this.messages[jid])
          this.messages[jid] = messages.slice(-MAX_MESSAGES)
        } else if (Array.isArray(this.messages[jid])) {
          if (this.messages[jid].length > MAX_MESSAGES) {
            this.messages[jid] = this.messages[jid].slice(-MAX_MESSAGES)
          }
        }
      })
    }

    if (this.chats) {
      Object.keys(this.chats).forEach(chatId => {
        if (this.chats[chatId].messages) {
          delete this.chats[chatId].messages
        }
      })
    }
  },

  bind(ev) {
    ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.remoteJid) continue

        const jid = msg.key.remoteJid
        const slim = slimMessage(msg)

        if (backend === 'memory') {
          this.messages[jid] = this.messages[jid] || []
          this.messages[jid].push(slim)

          if (this.messages[jid].length > MAX_MESSAGES) {
            this.messages[jid] = this.messages[jid].slice(-MAX_MESSAGES)
          }
        } else {
          try {
            await adapters[backend].save(jid, msg.key.id, slim)

            if (adapters[backend].touchUser) {
              const senderJid = msg.key.participant || msg.participant || jid
              await adapters[backend].touchUser(senderJid, msg.pushName || '')
            }
          } catch (e) {
            console.error(`[STORE] Failed to save message ${msg.key.id}:`, e.message)
          }
        }
      }
    })

    ev.on('contacts.update', async (contacts) => {
      for (const contact of contacts) {
        if (contact.id) {
          const contactData = {
            id: contact.id,
            name: contact.notify || contact.name || contact.verifiedName || '',
            notify: contact.notify,
            verifiedName: contact.verifiedName
          }

          if (backend === 'memory') {
            this.contacts[contact.id] = contactData
          } else {
            try {
              await adapters[backend].saveContact(contact.id, contactData)
            } catch (e) {
              console.error(`[STORE] Failed to save contact:`, e.message)
            }
          }
        }
      }
    })

    ev.on('contacts.set', async (contacts) => {
      for (const contact of contacts) {
        if (contact.id) {
          const contactData = {
            id: contact.id,
            name: contact.notify || contact.name || contact.verifiedName || '',
            notify: contact.notify,
            verifiedName: contact.verifiedName
          }

          if (backend === 'memory') {
            this.contacts[contact.id] = contactData
          } else {
            try {
              await adapters[backend].saveContact(contact.id, contactData)
            } catch (e) {
              console.error(`[STORE] Failed to save contact:`, e.message)
            }
          }
        }
      }
    })

    ev.on('chats.set', async (chats) => {
      for (const chat of chats) {
        if (chat.id) {
          const chatData = {
            id: chat.id,
            name: chat.name || chat.subject || '',
            conversationTimestamp: chat.conversationTimestamp,
            unreadCount: chat.unreadCount || 0
          }

          if (backend === 'memory') {
            this.chats[chat.id] = chatData
          } else {
            try {
              await adapters[backend].saveChat(chat.id, chatData)
            } catch (e) {
              console.error(`[STORE] Failed to save chat:`, e.message)
            }
          }
        }
      }
    })

    ev.on('chats.update', async (chats) => {
      for (const chat of chats) {
        if (chat.id) {
          if (backend === 'memory') {
            const existing = this.chats[chat.id] || {}
            this.chats[chat.id] = {
              id: chat.id,
              name: chat.name || chat.subject || existing.name || '',
              conversationTimestamp: chat.conversationTimestamp || existing.conversationTimestamp,
              unreadCount: chat.unreadCount !== undefined ? chat.unreadCount : existing.unreadCount
            }
          } else {
            try {
              const existing = await adapters[backend].getChat(chat.id) || {}
              const chatData = {
                id: chat.id,
                name: chat.name || chat.subject || existing.name || '',
                conversationTimestamp: chat.conversationTimestamp || existing.conversation_timestamp,
                unreadCount: chat.unreadCount !== undefined ? chat.unreadCount : existing.unread_count
              }
              await adapters[backend].saveChat(chat.id, chatData)
            } catch (e) {
              console.error(`[STORE] Failed to update chat:`, e.message)
            }
          }
        }
      }
    })

    ev.on('chats.delete', async (chats) => {
      for (const chatId of chats) {
        if (backend === 'memory') {
          delete this.chats[chatId]
          delete this.messages[chatId]
        } else {
          try {
            await adapters[backend].deleteChat(chatId)
          } catch (e) {
            console.error(`[STORE] Failed to delete chat:`, e.message)
          }
        }
      }
    })
  },

  async loadMessage(jid, id) {
    if (backend === 'memory') {
      const msg = this.messages[jid]?.find(m => m.key.id === id) || null
      return msg
    } else {
      try {
        return await adapters[backend].load(jid, id)
      } catch (e) {
        console.error(`[STORE] Failed to load message ${id}:`, e.message)
        return null
      }
    }
  },

  async saveSetting(chatId, key, value) {
    if (backend === 'memory') {
      const dataDir = './data'
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

      const filePath = path.join(dataDir, `${key}.json`)
      try {
        let data = {}
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        }

        if (!data[chatId]) data[chatId] = {}
        data[chatId] = value

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      } catch (e) {
        console.error(`[STORE] Failed to save setting ${key}:`, e.message)
      }
    } else {
      try {
        await adapters[backend].saveSetting(chatId, key, value)
      } catch (e) {
        console.error(`[STORE] Failed to save setting ${key}:`, e.message)
      }
    }
  },

  async getSetting(chatId, key) {
    if (backend === 'memory') {
      const dataDir = './data'
      const filePath = path.join(dataDir, `${key}.json`)

      try {
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return data[chatId] || null
        }
        return null
      } catch (e) {
        console.error(`[STORE] Failed to get setting ${key}:`, e.message)
        return null
      }
    } else {
      try {
        return await adapters[backend].getSetting(chatId, key)
      } catch (e) {
        console.error(`[STORE] Failed to get setting ${key}:`, e.message)
        return null
      }
    }
  },

  async getAllSettings(chatId) {
    if (backend === 'memory') {
      const dataDir = './data'
      const result = {}

      try {
        if (fs.existsSync(dataDir)) {
          const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))

          for (const file of files) {
            const key = path.basename(file, '.json')
            if (key === 'messageCount' || key === 'owner') continue

            const filePath = path.join(dataDir, file)
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

            if (data[chatId]) {
              result[key] = data[chatId]
            }
          }
        }
        return result
      } catch (e) {
        console.error(`[STORE] Failed to get all settings:`, e.message)
        return {}
      }
    } else {
      try {
        return await adapters[backend].getAllSettings(chatId)
      } catch (e) {
        console.error(`[STORE] Failed to get all settings:`, e.message)
        return {}
      }
    }
  },

  async getEnvBackedSetting(envKey, defaultValue = '') {
    const settingKey = `env_${envKey}`
    const envValue = process.env[envKey]

    if (envValue !== undefined && String(envValue).trim() !== '') {
      await this.saveSetting('global', settingKey, String(envValue))
      return String(envValue)
    }

    const dbValue = await this.getSetting('global', settingKey)
    const hasDbValue = dbValue !== null && dbValue !== undefined && String(dbValue).trim() !== ''
    const resolved = hasDbValue ? dbValue : defaultValue

    if (resolved !== null && resolved !== undefined) {
      process.env[envKey] = String(resolved)
      await this.saveSetting('global', settingKey, process.env[envKey])
      return process.env[envKey]
    }

    return ''
  },

  async touchUser(jid, pushName = '') {
    if (!jid || backend === 'memory') return
    if (!adapters[backend].touchUser) return
    try {
      await adapters[backend].touchUser(jid, pushName)
    } catch (e) {
      console.error('[STORE] Failed to touch user:', e.message)
    }
  },

  async upsertUserInfo(jid, info = {}) {
    if (!jid || backend === 'memory') return
    if (!adapters[backend].upsertUserInfo) return
    try {
      await adapters[backend].upsertUserInfo(jid, info)
    } catch (e) {
      console.error('[STORE] Failed to upsert user info:', e.message)
    }
  },

  async setOwnerJids(ownerJids = [], source = 'settings') {
    if (backend === 'memory') return []
    if (!adapters[backend].replaceOwnerJids) return []

    const normalized = [...new Set(ownerJids.map(normalizeToJid).filter(Boolean))]
    try {
      await adapters[backend].replaceOwnerJids(normalized, source)
      return normalized
    } catch (e) {
      console.error('[STORE] Failed to set owner JIDs:', e.message)
      return []
    }
  },

  async getOwnerJids() {
    if (backend === 'memory') return []
    if (!adapters[backend].getOwnerJids) return []
    try {
      return await adapters[backend].getOwnerJids()
    } catch (e) {
      console.error('[STORE] Failed to get owner JIDs:', e.message)
      return []
    }
  },

  async setDisabledPlugin(name, disabled = true, reason = '') {
    if (!name || backend === 'memory') return
    if (!adapters[backend].setPluginDisabled) return
    try {
      await adapters[backend].setPluginDisabled(name, disabled, reason)
    } catch (e) {
      console.error('[STORE] Failed to update disabled plugin:', e.message)
    }
  },

  async getDisabledPlugins() {
    if (backend === 'memory') return []
    if (!adapters[backend].getDisabledPlugins) return []
    try {
      return await adapters[backend].getDisabledPlugins()
    } catch (e) {
      console.error('[STORE] Failed to get disabled plugins:', e.message)
      return []
    }
  },

  async bootstrapInitialSchema(options = {}) {
    const ownerJids = Array.isArray(options.ownerJids)
      ? options.ownerJids
      : parseCsvList(options.ownerJids)
    const disabledPlugins = Array.isArray(options.disabledPlugins)
      ? options.disabledPlugins
      : parseCsvList(options.disabledPlugins)
    const envDefaults = options.envDefaults && typeof options.envDefaults === 'object'
      ? options.envDefaults
      : {}

    if (backend !== 'memory') {
      if (adapters[backend].replaceOwnerJids) {
        await this.setOwnerJids(ownerJids, 'bootstrap')
      }

      if (adapters[backend].setPluginDisabled && adapters[backend].getDisabledPlugins) {
        const normalizedDisabled = [...new Set(disabledPlugins.map(item => String(item).trim()).filter(Boolean))]
        const current = await this.getDisabledPlugins()

        for (const existing of current) {
          if (!normalizedDisabled.includes(existing)) {
            await this.setDisabledPlugin(existing, false)
          }
        }

        for (const pluginName of normalizedDisabled) {
          await this.setDisabledPlugin(pluginName, true, 'bootstrap')
        }
      }
    }

    const envKeys = Object.keys(envDefaults)
    for (const envKey of envKeys) {
      await this.getEnvBackedSetting(envKey, envDefaults[envKey])
    }
  },

  /**
  * BOT MODE METHODS (Advanced)
  */

  async setBotMode(mode) {
    const validModes = ['public', 'private', 'groups', 'inbox', 'self']
    if (!validModes.includes(mode)) {
      console.warn(`[STORE] Invalid mode: ${mode}, defaulting to public`)
      mode = 'public'
    }

    if (backend === 'memory') {
      this.botMode = mode
    } else {
      try {
        await adapters[backend].setMetadata('botMode', mode)
      } catch (e) {
        console.error(`[STORE] Failed to set bot mode:`, e.message)
      }
    }
  },

  async getBotMode() {
    if (backend === 'memory') {
      return this.botMode || 'public'
    } else {
      try {
        const mode = await adapters[backend].getMetadata('botMode')
        return mode || 'public'
      } catch (e) {
        console.error(`[STORE] Failed to get bot mode:`, e.message)
        return 'public'
      }
    }
  },

  async incrementMessageCount(chatId, userId) {
    if (backend === 'memory') {
      if (!this.messageCount[chatId]) {
        this.messageCount[chatId] = {}
      }
      if (!this.messageCount[chatId][userId]) {
        this.messageCount[chatId][userId] = 0
      }
      this.messageCount[chatId][userId]++
    } else {
      try {
        await adapters[backend].incrementCount(chatId, userId)
      } catch (e) {
        console.error(`[STORE] Failed to increment count for ${userId}:`, e.message)
      }
    }
  },

  async getMessageCount(chatId, userId) {
    if (backend === 'memory') {
      return this.messageCount[chatId]?.[userId] || 0
    } else {
      try {
        return await adapters[backend].getCount(chatId, userId)
      } catch (e) {
        console.error(`[STORE] Failed to get count for ${userId}:`, e.message)
        return 0
      }
    }
  },

  async getAllMessageCounts() {
    if (backend === 'memory') {
      return {
        isPublic: this.isPublic,
        messageCount: this.messageCount
      }
    } else {
      try {
        return await adapters[backend].getAllCounts()
      } catch (e) {
        console.error(`[STORE] Failed to get all counts:`, e.message)
        return { isPublic: true, messageCount: {} }
      }
    }
  },

  async setPublicMode(isPublic) {
    if (backend === 'memory') {
      this.isPublic = isPublic
    } else {
      try {
        await adapters[backend].setPublicMode(isPublic)
      } catch (e) {
        console.error(`[STORE] Failed to set public mode:`, e.message)
      }
    }
  },

  async getPublicMode() {
    if (backend === 'memory') {
      return this.isPublic
    } else {
      try {
        const data = await adapters[backend].getAllCounts()
        return data.isPublic
      } catch (e) {
        console.error(`[STORE] Failed to get public mode:`, e.message)
        return true
      }
    }
  },

  /**
  * Get store statistics
  */

  getStats() {
    let totalMessages = 0
    let totalContacts = Object.keys(this.contacts).length
    let totalChats = Object.keys(this.chats).length
    let totalMessageCounts = 0

    if (backend === 'memory') {
      Object.values(this.messages).forEach(chatMessages => {
        if (Array.isArray(chatMessages)) {
          totalMessages += chatMessages.length
        }
      })

      Object.values(this.messageCount).forEach(chatCounts => {
        if (typeof chatCounts === 'object') {
          totalMessageCounts += Object.keys(chatCounts).length
        }
      })
    }

    return {
      backend,
      messages: backend === 'memory' ? totalMessages : 'stored in database',
      contacts: totalContacts,
      chats: totalChats,
      messageCounts: backend === 'memory' ? totalMessageCounts : 'stored in database',
      maxMessagesPerChat: messageLimit === Infinity ? 'unlimited' : messageLimit,
      isPublic: this.isPublic,
      botMode: this.botMode
    }
  }
}

/**
* LIFECYCLE MANAGEMENT
*/

if (backend !== 'memory') {
  setTimeout(() => {
    if (adapters[backend].cleanup) {
      Promise.resolve(adapters[backend].cleanup()).catch(err =>
        console.error('[STORE] Initial cleanup error:', err)
      )
    }
  }, 5 * 60 * 1000)

  cleanupTimer = setInterval(() => {
    if (adapters[backend].cleanup) {
      Promise.resolve(adapters[backend].cleanup()).catch(err =>
        console.error('[STORE] Periodic cleanup error:', err)
      )
    }
  }, CLEANUP_INTERVAL)
}

if (backend === 'memory') {
  setInterval(() => {
    store.writeToFile()
  }, 5 * 60 * 1000)
}

setInterval(() => {
  if (store.chats) {
    let cleaned = 0
    Object.keys(store.chats).forEach(chatId => {
      if (store.chats[chatId].messages) {
        delete store.chats[chatId].messages
        cleaned++
      }
    })
    if (cleaned > 0) {
      console.log(`[STORE] Cleaned messages from ${cleaned} chats`)
    }
  }
}, 60 * 1000)

const gracefulShutdown = async (signal) => {
  console.log(`[STORE] Received ${signal}, shutting down gracefully...`)

  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }

  if (backend === 'memory') {
    store.writeToFile()
  }

  if (backend !== 'memory' && adapters[backend].close) {
    try {
      await adapters[backend].close()
    } catch (e) {
      console.error('[STORE] Error during shutdown:', e.message)
    }
  }

  console.log('[STORE] Shutdown complete')
}

process.on('SIGINT', async () => {
  await gracefulShutdown('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await gracefulShutdown('SIGTERM')
  process.exit(0)
})

process.on('beforeExit', async () => {
  if (backend === 'memory') {
    store.writeToFile()
  }
})

process.on('uncaughtException', (err) => {
  console.error('[STORE] Uncaught exception:', err)
  if (backend === 'memory') {
    store.writeToFile()
  }
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[STORE] Unhandled rejection at:', promise, 'reason:', reason)
})

console.log(`[STORE] Initialized with backend: ${backend}`)
console.log(`[STORE] Message limit per chat: ${messageLimit === Infinity ? 'unlimited' : messageLimit}`)

module.exports = store;

/*****************************************************************************
 *                                                                           *
 *                     Developed By Bot Owner                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/pgwiz                         *
 *  ▶️  YouTube  : https://youtube.com/@pgwiz                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029Va8cpObHwXbDoZE9VY3K     *
 *                                                                           *
 *    © 2026 pgwiz. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the PGWIZ-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/


