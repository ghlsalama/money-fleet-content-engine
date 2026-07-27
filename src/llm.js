import { config } from './config.js';
import { log } from './log.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Calls an OpenAI-compatible /chat/completions endpoint.
// Works with Groq (free), OpenAI, Google Gemini's OpenAI-compatible endpoint, and local Ollama.
export async function chat({ system, user, temperature = 0.7, maxTokens = 1200 }) {
  if (!config.llm.apiKey) throw new Error('LLM_API_KEY not set');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  const doRequest = async () => {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}: ${JSON.stringify(json.error || json).slice(0, 300)}`);
    }
    const out = json.choices?.[0]?.message?.content;
    if (!out || !out.trim()) throw new Error('LLM returned empty content');
    return out.trim();
  };

  try {
    return await doRequest();
  } catch (e) {
    // One retry with backoff — free tiers occasionally hiccup or rate-limit.
    log.warn('LLM call failed, retrying once after backoff:', e.message);
    await sleep(2500);
    return await doRequest();
  }
}
