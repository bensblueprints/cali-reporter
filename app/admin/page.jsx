'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [posts, setPosts] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  async function load() {
    const r = await fetch('/api/admin/posts');
    if (r.status === 401) { router.push('/admin/login'); return; }
    const j = await r.json();
    setPosts(j.posts || []);
  }
  useEffect(() => { load(); }, []);

  async function pullNews() {
    setRunning(true);
    setRunResult(null);
    const r = await fetch('/api/admin/aggregate', { method: 'POST' });
    const j = await r.json();
    setRunResult(j);
    setRunning(false);
    load();
  }

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
  }

  async function del(id) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex items-center justify-between border-b-2 border-ink pb-4 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-muted">Editor</div>
          <h1 className="font-display text-3xl">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={pullNews} disabled={running}
                  className="border border-ink px-4 py-2 text-xs uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-50">
            {running ? 'Pulling…' : 'Pull news now'}
          </button>
          <Link href="/admin/new" className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent">
            + New post
          </Link>
          <button onClick={logout} className="border border-rule px-4 py-2 text-xs uppercase tracking-widest text-muted hover:text-ink">
            Sign out
          </button>
        </div>
      </header>

      {runResult && (
        <div className={`mb-6 border p-3 text-sm ${runResult.ok ? 'border-rule bg-paper' : 'border-accent text-accent'}`}>
          <div className="font-semibold">Aggregator {runResult.ok ? 'finished' : 'failed'} (exit {runResult.code})</div>
          {runResult.stdout && <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">{runResult.stdout}</pre>}
          {runResult.stderr && <pre className="mt-2 max-h-32 overflow-auto text-xs whitespace-pre-wrap text-accent">{runResult.stderr}</pre>}
        </div>
      )}

      {posts === null ? (
        <p className="text-muted">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-muted">No posts yet — write one or pull news.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted">
            <tr className="border-b border-rule">
              <th className="py-2">Title</th>
              <th className="py-2">Category</th>
              <th className="py-2">Origin</th>
              <th className="py-2">Published</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.id} className="border-b border-rule align-top">
                <td className="py-3 pr-3">
                  <Link href={`/admin/edit/${p.id}`} className="font-display text-base hover:text-accent">
                    {p.title}
                  </Link>
                  {p.deck && <div className="text-xs text-muted line-clamp-1">{p.deck}</div>}
                </td>
                <td className="py-3 pr-3 capitalize">{p.category}</td>
                <td className="py-3 pr-3 text-muted">
                  {p.origin === 'aggregated' && p.source_name ? `via ${p.source_name}` : 'Original'}
                </td>
                <td className="py-3 pr-3 text-muted whitespace-nowrap">
                  {new Date(p.published_at).toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <Link href={`/article/${p.slug}`} target="_blank" className="text-xs uppercase tracking-widest mr-3 hover:text-accent">View</Link>
                  <button onClick={() => del(p.id)} className="text-xs uppercase tracking-widest text-accent hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
