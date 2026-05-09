import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth.js';
import { getDb, insertPost, listPosts } from '../../../../lib/db.js';
import { makeSlug } from '../../../../lib/format.js';

export const runtime = 'nodejs';

function authOr401(handler) {
  return async (...args) => {
    try { requireAdmin(); } catch (e) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
    return handler(...args);
  };
}

export const GET = authOr401(async () => {
  const posts = listPosts({ limit: 200 });
  return NextResponse.json({ posts });
});

export const POST = authOr401(async (req) => {
  const body = await req.json().catch(() => ({}));
  const { title, deck, content_html, hero_image, hero_alt, category } = body || {};
  if (!title || !content_html || !hero_image) {
    return NextResponse.json({ error: 'title, content_html, and hero_image are required' }, { status: 400 });
  }
  const db = getDb();
  let slug = makeSlug(title);
  // Ensure unique slug.
  const exists = db.prepare('SELECT 1 FROM posts WHERE slug = ?').get(slug);
  if (exists) slug = makeSlug(title, Date.now().toString(36));
  const id = insertPost({
    slug, title, deck, content_html, hero_image, hero_alt,
    category: category || 'national',
    origin: 'original',
    published_at: new Date().toISOString(),
  });
  return NextResponse.json({ id, slug });
});
