import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { requireAdmin } from '../../../../lib/auth.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  try { requireAdmin(); } catch (e) { return NextResponse.json({ error: e.message }, { status: e.status || 401 }); }

  const script = path.join(process.cwd(), 'scripts', 'aggregate.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: process.env,
      cwd: process.cwd(),
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      resolve(NextResponse.json({
        ok: code === 0,
        code,
        stdout: out.slice(-4000),
        stderr: err.slice(-2000),
      }));
    });
  });
}
