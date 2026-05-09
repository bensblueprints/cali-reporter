// Replicate via raw fetch — no SDK to keep deps minimal.
import { saveRemoteImage } from '../image-store.js';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

export async function imageReplicate({ title, deck, category }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set');
  const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell';

  const prompt = imagePrompt({ title, deck, category });

  // Use the model-name endpoint so we don't have to hard-code version IDs.
  const startResp = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '16:9',
        output_format: 'jpg',
        output_quality: 88,
        num_outputs: 1,
      },
    }),
  });
  if (!startResp.ok) {
    const t = await startResp.text();
    throw new Error(`replicate start failed: ${startResp.status} ${t.slice(0, 200)}`);
  }
  let pred = await startResp.json();

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('replicate poll timeout');
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const r = await fetch(pred.urls.get, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) throw new Error(`replicate poll failed: ${r.status}`);
    pred = await r.json();
  }
  if (pred.status !== 'succeeded') {
    throw new Error(`replicate ${pred.status}: ${pred.error || 'no error'}`);
  }
  const remoteUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!remoteUrl) throw new Error('replicate succeeded but produced no output');
  const localUrl = await saveRemoteImage(remoteUrl, { hint: title });
  return { url: localUrl, alt: title };
}

function imagePrompt({ title, deck, category }) {
  const styleByCat = {
    national:   'documentary editorial photograph, sober news magazine aesthetic, soft natural light',
    california: 'editorial photograph, California sunlight, Pacific palette, sun-bleached',
    business:   'clean business editorial photograph, muted tones, magazine cover quality',
  };
  const style = styleByCat[category] || styleByCat.national;
  const subject = [title, deck].filter(Boolean).join('. ');
  return `${style}. ${subject}. No text overlays, no logos, no watermark. Wide 16:9, high detail, photographic.`;
}
