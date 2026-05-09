import Link from 'next/link';
import { CATEGORIES } from '../lib/db.js';

export default function Header() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  return (
    <header className="border-b-2 border-ink">
      <div className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
          <span>{today}</span>
          <span className="hidden sm:inline">Updated 3× daily · 7:30am · 12:30pm · 6:30pm Pacific</span>
          <Link href="/about" className="hover:text-accent">About</Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-4 text-center">
        <Link href="/" className="inline-block">
          <span className="font-display block text-5xl sm:text-6xl tracking-tight">Cali Reporter</span>
          <span className="mt-1 block text-[0.7rem] uppercase tracking-[0.35em] text-muted">
            National · California · West Coast Business
          </span>
        </Link>
      </div>
      <nav className="border-t border-rule">
        <ul className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm uppercase tracking-widest">
          <li><Link href="/" className="hover:text-accent">Front Page</Link></li>
          {CATEGORIES.map(c => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} className="hover:text-accent">{c.label}</Link>
            </li>
          ))}
          <li><Link href="/rss.xml" className="hover:text-accent">RSS</Link></li>
        </ul>
      </nav>
    </header>
  );
}
