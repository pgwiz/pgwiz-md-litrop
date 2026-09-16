const axios = require('axios');
const settings = require('../settings');

// Conversational memory store: `${chatId}_${senderId}` -> Array of { role: 'user' | 'assistant', content: string }
const conversationMemory = new Map();
const MAX_MEMORY_TURNS = 6; // Keeps last 3 user prompts & 3 assistant replies

// Clean stale memory entries every 30 minutes
setInterval(() => {
  if (conversationMemory.size > 200) {
    conversationMemory.clear();
  }
}, 30 * 60 * 1000);

/**
 * Multi-provider AI text query engine
 */
async function queryAI(prompt, model = 'gemini', history = []) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;

  // 1. Official Google Gemini API (if key available)
  if (model === 'gemini' && GEMINI_KEY) {
    try {
      const contents = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        { contents },
        { timeout: 20000 }
      );
      const text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, provider: 'Google Gemini (Official)' };
    } catch (e) {
      console.warn('Official Gemini API failed, falling back:', e.message);
    }
  }

  // 2. Official OpenAI API (if key available)
  if ((model === 'gpt' || model === 'openai') && OPENAI_KEY) {
    try {
      const messages = [
        { role: 'system', content: 'You are a helpful, concise AI assistant integrated into a WhatsApp bot.' },
        ...history,
        { role: 'user', content: prompt }
      ];

      const gptRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000
        },
        {
          headers: { Authorization: `Bearer ${OPENAI_KEY}` },
          timeout: 20000
        }
      );
      const text = gptRes.data?.choices?.[0]?.message?.content;
      if (text) return { text, provider: 'OpenAI GPT-4o-mini' };
    } catch (e) {
      console.warn('Official OpenAI API failed, falling back:', e.message);
    }
  }

  // 3. Official DeepSeek API (if key available)
  if (model === 'deepseek' && DEEPSEEK_KEY) {
    try {
      const messages = [
        { role: 'system', content: 'You are DeepSeek AI, a helpful, intelligent coding and general assistant.' },
        ...history,
        { role: 'user', content: prompt }
      ];

      const deepseekRes = await axios.post(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          messages,
          max_tokens: 1000
        },
        {
          headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` },
          timeout: 20000
        }
      );
      const text = deepseekRes.data?.choices?.[0]?.message?.content;
      if (text) return { text, provider: 'DeepSeek-V3' };
    } catch (e) {
      console.warn('Official DeepSeek API failed, falling back:', e.message);
    }
  }

  // 4. Primary High-Reliability Free Provider: Pollinations AI
  const pollinationsModelMap = {
    gemini: 'gemini',
    gpt: 'openai',
    openai: 'openai',
    deepseek: 'deepseek',
    claude: 'claude-hybrid',
    copilot: 'openai',
    ai: 'deepseek'
  };

  const chosenPolliModel = pollinationsModelMap[model] || 'deepseek';

  try {
    const systemPrompt = encodeURIComponent('You are a helpful, smart, concise WhatsApp AI assistant. Use clean WhatsApp formatting (bold with *, monospace code blocks with ```).');
    const userPrompt = encodeURIComponent(prompt);
    const polliUrl = `https://text.pollinations.ai/${userPrompt}?model=${chosenPolliModel}&system=${systemPrompt}`;

    const polliRes = await axios.get(polliUrl, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (polliRes.data && typeof polliRes.data === 'string' && polliRes.data.trim().length > 0) {
      return {
        text: polliRes.data.trim(),
        provider: `Pollinations (${chosenPolliModel.toUpperCase()})`
      };
    }
  } catch (e) {
    console.warn('Pollinations AI failed, trying secondary fallbacks:', e.message);
  }

  // 5. Secondary Free Fallbacks (ZellAPI, Vreden, GiftedTech, RyzenDesu)
  const secondaryEndpoints = [
    {
      url: `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(prompt)}`,
      parse: (d) => d?.result
    },
    {
      url: `https://vapis.my.id/api/gemini?q=${encodeURIComponent(prompt)}`,
      parse: (d) => d?.data || d?.result
    },
    {
      url: `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(prompt)}`,
      parse: (d) => d?.answer || d?.result
    },
    {
      url: `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(prompt)}`,
      parse: (d) => d?.result
    }
  ];

  for (const ep of secondaryEndpoints) {
    try {
      const res = await axios.get(ep.url, { timeout: 12000 });
      const parsed = ep.parse(res.data);
      if (parsed && typeof parsed === 'string' && parsed.trim().length > 0) {
        return { text: parsed.trim(), provider: 'Cloud AI' };
      }
    } catch {}
  }

  throw new Error('All AI providers are currently busy or unavailable. Please try again shortly.');
}

module.exports = {
  command: 'ai',
  aliases: ['gpt', 'gemini', 'deepseek', 'claude', 'copilot', 'chat', 'ask'],
  category: 'ai',
  description: 'Ask questions to Multi-Model AI with conversation memory (Gemini, GPT, DeepSeek, Claude)',
  usage: '.ai <prompt> | .gpt <prompt> | .gemini <prompt> | .deepseek <prompt> | .ai reset',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || chatId;
    const memoryKey = `${chatId}_${senderId}`;

    const invoked = (context.invokedCmd || context.command || 'ai').toLowerCase();
    const rawQuery = args.join(' ').trim();

    // Memory Reset Command
    if (rawQuery.toLowerCase() === 'reset' || rawQuery.toLowerCase() === 'clear') {
      conversationMemory.delete(memoryKey);
      return await sock.sendMessage(chatId, {
        text: '🧹 *AI Conversation Memory Reset!*\nStarting a fresh conversation.'
      }, { quoted: message });
    }

    if (!rawQuery) {
      const prefix = context.usedPrefix || '.';
      return await sock.sendMessage(chatId, {
        text: `🤖 *Multi-Model AI Assistant*\n\n` +
          `Usage:\n` +
          `• *${prefix}ai <query>* (Smart Default AI)\n` +
          `• *${prefix}gpt <query>* (OpenAI GPT-4o-mini)\n` +
          `• *${prefix}gemini <query>* (Google Gemini)\n` +
          `• *${prefix}deepseek <query>* (DeepSeek-V3)\n` +
          `• *${prefix}claude <query>* (Claude AI)\n` +
          `• *${prefix}ai reset* (Clear conversation context)\n\n` +
          `_Example: ${prefix}gemini write a python script to parse json_`
      }, { quoted: message });
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '🧠', key: message.key } });

      // Determine model from command alias
      let targetModel = 'gemini';
      if (invoked === 'gpt' || invoked === 'openai') targetModel = 'gpt';
      else if (invoked === 'deepseek') targetModel = 'deepseek';
      else if (invoked === 'claude') targetModel = 'claude';
      else if (invoked === 'copilot') targetModel = 'copilot';
      else targetModel = 'gemini';

      // Retrieve history
      const history = conversationMemory.get(memoryKey) || [];

      // Query AI
      const result = await queryAI(rawQuery, targetModel, history);

      // Save to conversation memory
      history.push({ role: 'user', content: rawQuery });
      history.push({ role: 'assistant', content: result.text });
      while (history.length > MAX_MEMORY_TURNS) {
        history.shift();
      }
      conversationMemory.set(memoryKey, history);

      const responseText = `🤖 *AI [${targetModel.toUpperCase()}]*\n\n${result.text}\n\n> ⚡ Powered by ${result.provider}`;

      await sock.sendMessage(chatId, {
        text: responseText
      }, { quoted: message });

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
      console.error('AI Command Error:', err.message);
      await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
      await sock.sendMessage(chatId, {
        text: `❌ *AI Service Error:* ${err.message}`
      }, { quoted: message });
    }
  }
};
