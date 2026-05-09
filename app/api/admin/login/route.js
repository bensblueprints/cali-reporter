import { NextResponse } from 'next/server';
import { verifyPassword, issueSession, clearSession } from '../../../../lib/auth.js';

export const runtime = 'nodejs';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'missing password' }, { status: 400 });
  }
  const ok = await verifyPassword(password);
  if (!ok) {
    // Constant-ish delay to discourage password fishing.
    await new Promise(r => setTimeout(r, 400));
    return NextResponse.json({ error: 'invalid password' }, { status: 401 });
  }
  issueSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearSession();
  return NextResponse.json({ ok: true });
}
