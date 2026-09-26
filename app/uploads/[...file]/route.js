import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Next.js standalone only serves public/ files known when the server starts.
// Hero images and headshots are generated at runtime into public/uploads,
// so this handler streams them from disk. Files that predate the server are
// served by the static public handler before this route is consulted; the
// bytes are the same either way.

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

const TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export async function GET(_req, { params }) {
  const parts = Array.isArray(params?.file) ? params.file : [params?.file].filter(Boolean);
  const rel = parts.map(p => String(p)).join('/');
  const resolved = path.normalize(path.join(UPLOADS_DIR, rel));
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const ext = resolved.split('.').pop().toLowerCase();
  const buf = fs.readFileSync(resolved);
  return new Response(buf, {
    headers: {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
