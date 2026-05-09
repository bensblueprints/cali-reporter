import Anthropic from '@anthropic-ai/sdk';
import { activeVoice } from './voices.js';

export async function rewriteAnthropic(input) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const voice = activeVoice();

  const resp = await client.messages.create({
    model,
    max_tokens: voice.maxTokens,
    system: voice.system,
    messages: [{ role: 'user', content: voice.userTemplate(input) }],
  });

  const text = resp.content.find(b => b.type === 'text')?.text || '';
  const parsed = parseStrictJson(text);
  let html = String(parsed.html || '').trim();
  // Append source attribution paragraph if the model didn't do it.
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
  // Strip code fences if the model added them despite instructions.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Last-ditch: extract the largest {...} block.
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('anthropic returned non-JSON output');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
