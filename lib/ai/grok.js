// xAI / Grok adapter — OpenAI-compatible API at https://api.x.ai/v1
// Text via OpenAI SDK with baseURL override; images via direct fetch
// (xAI image endpoint differs slightly from OpenAI's).

import OpenAI from 'openai';
import { activeVoice } from './voices.js';
import { saveRemoteImage } from '../image-store.js';

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

/**
 * Generate a hero image via xAI's grok-imagine-image model.
 * The article title + deck drive the editorial-photo prompt; the source's
 * og:image (if available) shapes the prompt's subject hint.
 *
 * Note: xAI's current image model is text-to-image, not image-to-image —
 * we use the og:image as inspiration in the prompt, not as a reference frame.
 */
export async function imageGrok({ title, deck, category, ogImageHint }) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY not set');
  const model = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image';

  const prompt = imagePrompt({ title, deck, category, ogImageHint });

  const resp = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      response_format: 'url',
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`grok image ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  const url = j?.data?.[0]?.url;
  if (!url) throw new Error('grok image: empty response');
  const localUrl = await saveRemoteImage(url, { hint: title });
  return { url: localUrl, alt: title };
}

function imagePrompt({ title, deck, category, ogImageHint }) {
  const styleByCat = {
    national:   'editorial news photograph, photojournalistic style, sober tone, soft natural light, magazine cover quality',
    california: 'editorial photograph, California sunlight, Pacific palette, sun-bleached, photojournalistic style',
    business:   'clean business editorial photograph, muted tones, magazine cover quality, photojournalistic style',
  };
  const style = styleByCat[category] || styleByCat.national;
  const subject = [title, deck].filter(Boolean).join('. ');
  const hint = ogImageHint ? ` (visual reference cue: ${ogImageHint})` : '';
  return `${style}. Subject: ${subject}${hint}. Composition: wide 16:9, high detail, photographic. No text overlays, no logos, no watermarks. Avoid generic AI-art aesthetics — aim for the look of a real photo from a wire service.`;
}
