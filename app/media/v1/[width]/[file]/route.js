import crypto from 'node:crypto';
import { optimizedImage } from '../../../../../lib/image-optimizer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  if (!params.file.endsWith('.webp')) return new Response(null, { status: 404 });
  try {
    const bytes = await optimizedImage(params.file.slice(0, -5), Number(params.width));
    const etag = `"${crypto.createHash('sha256').update(bytes).digest('hex')}"`;
    const headers = {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'ETag': etag,
    };
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
  } catch (error) {
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    if (status === 500) console.error('Image optimization failed:', error.message);
    return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
