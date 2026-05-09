// xAI / Grok adapter — OpenAI-compatible API at https://api.x.ai/v1
// Reuses the OpenAI SDK with a baseURL override.

import OpenAI from 'openai';
import { activeVoice } from './voices.js';

function client() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY not set');
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.x.ai/v1',
  });
}

export async function rewriteGrok(input) {
  const c = client();
  const model = process.env.GROK_MODEL || 'grok-4.20-0309-non-reasoning';
  const voice = activeVoice();

  // xAI supports OpenAI-style response_format JSON mode on chat.completions.
  const resp = await c.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: voice.system + '\n\nReturn JSON only — no code fences, no prose preamble.' },
      { role: 'user', content: voice.userTemplate(input) },
    ],
  });

  const text = resp.choices?.[0]?.message?.content || '';
  const parsed = parseStrictJson(text);
  let html = String(parsed.html || '').trim();
  const { sourceName, sourceUrl } = input;
  if (sourceUrl && !html.toLowerCase().includes(String(sourceName || '').toLowerCase().slice(0, 12))) {
    html += `\n<p class="source-line">Original reporting: <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(sourceName)}</a>.</p>`;
  }
  return {
    html,
    deck: String(parsed.deck || '').trim(),
  };
}

function parseStrictJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('grok returned non-JSON output: ' + cleaned.slice(0, 120));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
