import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth.js';
import { generateHeroImage } from '../../../../lib/ai/index.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req) {
  try { requireAdmin(); } catch (e) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }
  const { title, deck, category } = await req.json().catch(() => ({}));
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const { url, alt } = await generateHeroImage({ title, deck: deck || '', category: category || 'national' });
  return NextResponse.json({ url, alt });
}
