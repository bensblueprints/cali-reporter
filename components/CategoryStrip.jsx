import Link from 'next/link';
import ArticleCard from './ArticleCard.jsx';

export default function CategoryStrip({ label, slug, posts }) {
  if (!posts?.length) return null;
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between border-b-2 border-ink mb-6 pb-2">
        <h2 className="font-display text-3xl">{label}</h2>
        <Link href={`/category/${slug}`} className="text-xs uppercase tracking-widest hover:text-accent">
          See all →
        </Link>
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 3).map(p => <ArticleCard key={p.id} post={p} />)}
      </div>
    </section>
  );
}
