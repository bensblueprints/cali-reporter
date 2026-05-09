import { notFound } from 'next/navigation';
import ArticleCard from '../../../components/ArticleCard.jsx';
import { listPosts, CATEGORIES } from '../../../lib/db.js';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }) {
  const cat = CATEGORIES.find(c => c.slug === params.slug);
  if (!cat) return {};
  return {
    title: `${cat.label}`,
    description: `${cat.label} stories on Cali Reporter.`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default function CategoryPage({ params }) {
  const cat = CATEGORIES.find(c => c.slug === params.slug);
  if (!cat) notFound();
  const posts = listPosts({ category: cat.slug, limit: 60 });
  const lead = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 border-b-2 border-ink pb-6">
        <span className="text-[11px] uppercase tracking-[0.3em] text-accent">Section</span>
        <h1 className="font-display text-5xl mt-1">{cat.label}</h1>
      </header>

      {lead ? (
        <ArticleCard post={lead} variant="lead" />
      ) : (
        <p className="text-muted">No stories in this section yet.</p>
      )}

      {rest.length > 0 && (
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map(p => <ArticleCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
