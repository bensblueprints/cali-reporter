import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'cali_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error('ADMIN_JWT_SECRET not set');
  return s;
}

export async function verifyPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) throw new Error('ADMIN_PASSWORD_HASH not set');
  return bcrypt.compare(password, hash);
}

export function issueSession() {
  const token = jwt.sign({ role: 'admin' }, secret(), { expiresIn: COOKIE_MAX_AGE });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

export function readSession() {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  try {
    return jwt.verify(c.value, secret());
  } catch {
    return null;
  }
}

export function requireAdmin() {
  const s = readSession();
  if (!s || s.role !== 'admin') {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  return s;
}
