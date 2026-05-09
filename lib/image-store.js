// Download a remote image to /public/uploads and return its public URL path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function saveRemoteImage(remoteUrl, { hint = '' } = {}) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const r = await fetch(remoteUrl);
  if (!r.ok) throw new Error(`image fetch ${r.status} for ${remoteUrl.slice(0, 80)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = sniffExt(r.headers.get('content-type')) || extFromUrl(remoteUrl) || 'jpg';
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const slug = (hint || 'hero')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'hero';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const name = `${stamp}-${slug}-${hash}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return `/uploads/${name}`;
}

function sniffExt(contentType) {
  if (!contentType) return null;
  const t = contentType.toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  return null;
}

function extFromUrl(u) {
  try {
    const pathname = new URL(u).pathname;
    const m = pathname.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
    return m ? m[1].toLowerCase() : null;
  } catch { return null; }
}
