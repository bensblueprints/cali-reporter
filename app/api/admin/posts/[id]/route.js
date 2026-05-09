import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth.js';
import { getPostById, updatePost, deletePost } from '../../../../../lib/db.js';

export const runtime = 'nodejs';

function authed(fn) {
  return async (...args) => {
    try { requireAdmin(); } catch (e) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
    return fn(...args);
  };
}

export const GET = authed(async (_req, { params }) => {
  const post = getPostById(Number(params.id));
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ post });
});

export const PATCH = authed(async (req, { params }) => {
  const body = await req.json().catch(() => ({}));
  updatePost(Number(params.id), body);
  return NextResponse.json({ ok: true });
});

export const DELETE = authed(async (_req, { params }) => {
  deletePost(Number(params.id));
  return NextResponse.json({ ok: true });
});
