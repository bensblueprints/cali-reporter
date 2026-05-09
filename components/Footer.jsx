import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t-2 border-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <div className="font-display text-2xl mb-2">Cali Reporter</div>
          <p className="text-muted leading-relaxed">
            A magazine-style daily on U.S. national headlines, California politics
            and culture, and West Coast business.
          </p>
        </div>
        <div>
          <div className="uppercase tracking-widest text-xs mb-3 text-muted">Sections</div>
          <ul className="space-y-1">
            <li><Link href="/category/national" className="hover:text-accent">National</Link></li>
            <li><Link href="/category/california" className="hover:text-accent">California</Link></li>
            <li><Link href="/category/business" className="hover:text-accent">Business</Link></li>
            <li><Link href="/rss.xml" className="hover:text-accent">RSS feed</Link></li>
          </ul>
        </div>
        <div>
          <div className="uppercase tracking-widest text-xs mb-3 text-muted">Office</div>
          <ul className="space-y-1 text-muted">
            <li><Link href="/about" className="hover:text-accent">About &amp; sources</Link></li>
            <li><Link href="/admin/login" className="hover:text-accent">Editor sign-in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted flex items-center justify-between">
          <span>© {year} Cali Reporter</span>
          <span>Built in California</span>
        </div>
      </div>
    </footer>
  );
}
