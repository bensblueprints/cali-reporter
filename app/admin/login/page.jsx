'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm px-4 py-24 text-muted text-center">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error || 'login failed');
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="font-display text-3xl mb-6 text-center">Editor sign-in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className="w-full border border-rule px-3 py-2 bg-paper focus:outline-none focus:border-ink"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <div className="text-sm text-accent">{error}</div>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-ink text-paper py-2 text-sm uppercase tracking-widest disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
