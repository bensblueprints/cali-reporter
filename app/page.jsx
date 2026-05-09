import ArticleCard from '../components/ArticleCard.jsx';
import CategoryStrip from '../components/CategoryStrip.jsx';
import { listPosts, CATEGORIES } from '../lib/db.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HomePage() {
  const recent = listPosts({ limit: 50 });
  const lead = recent[0];
  const secondary = recent.slice(1, 5);
  const compact = recent.slice(5, 11);

  const byCategory = Object.fromEntries(
    CATEGORIES.map(c => [c.slug, recent.filter(p => p.category === c.slug).slice(0, 3)])
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero strip */}
      {lead ? (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <ArticleCard post={lead} variant="lead" />
          </div>
          <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
            <h2 className="font-display text-xl border-b-2 border-ink pb-2 mb-3">Also today</h2>
            <div>
              {compact.map(p => <ArticleCard key={p.id} post={p} variant="compact" />)}
            </div>
          </aside>
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Secondary row */}
      {secondary.length > 0 && (
        <section className="mt-16 border-t-2 border-ink pt-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {secondary.map(p => <ArticleCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {/* Per-category strips */}
      {CATEGORIES.map(c => (
        <CategoryStrip key={c.slug} label={c.label} slug={c.slug} posts={byCategory[c.slug]} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <h1 className="font-display text-4xl mb-4">No stories yet</h1>
      <p className="text-muted">
        Run <code className="bg-rule px-2 py-1">npm run aggregate</code> to pull from the configured feeds, or sign in to publish an original.
      </p>
    </div>
  );
}
