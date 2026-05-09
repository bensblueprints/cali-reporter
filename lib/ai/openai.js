import OpenAI from 'openai';
import { saveRemoteImage } from '../image-store.js';
import { activeVoice } from './voices.js';

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function rewriteOpenAI(input) {
  const c = client();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const voice = activeVoice();

  const resp = await c.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: voice.system + '\n\nReturn JSON only — no code fences.' },
      { role: 'user', content: voice.userTemplate(input) },
    ],
  });
  const parsed = JSON.parse(resp.choices[0].message.content);
  return {
    html: String(parsed.html || '').trim(),
    deck: String(parsed.deck || '').trim(),
  };
}

export async function imageOpenAI({ title, deck, category }) {
  const c = client();
  const prompt = imagePrompt({ title, deck, category });
  const resp = await c.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1792x1024',
    quality: 'standard',
    n: 1,
  });
  const url = resp.data[0]?.url;
  if (!url) throw new Error('openai image: empty response');
  const localUrl = await saveRemoteImage(url, { hint: title });
  return { url: localUrl, alt: title };
}

function imagePrompt({ title, deck, category }) {
  const styleByCat = {
    national:   'documentary editorial photo, sober news magazine aesthetic',
    california: 'sun-warmed editorial photo, California light, Pacific palette',
    business:   'clean business editorial photo, muted tones, magazine cover quality',
  };
  const style = styleByCat[category] || styleByCat.national;
  return `${style}. Subject: ${title}. ${deck || ''}. No text, no logos, no people's faces in close-up. Wide aspect, high detail.`;
}
