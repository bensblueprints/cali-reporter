import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, listPosts } from '../../../lib/db.js';
import { formatDate, excerpt } from '../../../lib/format.js';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }) {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.deck || excerpt(post.content_html, 160),
    alternates: { canonical: `/article/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.deck || excerpt(post.content_html, 160),
      images: post.hero_image ? [{ url: post.hero_image }] : [],
      type: 'article',
      publishedTime: post.published_at,
    },
  };
}

export default function ArticlePage({ params }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const related = listPosts({ category: post.category, limit: 6 })
    .filter(p => p.id !== post.id)
    .slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-center mb-8">
        <Link href={`/category/${post.category}`}
              className="text-[11px] uppercase tracking-[0.3em] text-accent">
          {labelFor(post.category)}
        </Link>
        <h1 className="font-display text-4xl sm:text-5xl mt-2 leading-tight">{post.title}</h1>
        {post.deck && <p className="mt-4 text-xl text-muted leading-snug">{post.deck}</p>}
        <div className="mt-4 text-xs uppercase tracking-widest text-muted">
          {formatDate(post.published_at)}
          {post.origin === 'aggregated' && post.source_name && (
            <> · via {post.source_url
              ? <a href={post.source_url} className="hover:text-accent" rel="nofollow noopener" target="_blank">{post.source_name}</a>
              : post.source_name}
            </>
          )}
        </div>
      </div>

      {post.hero_image && (
        <figure className="mb-10">
          <img src={post.hero_image} alt={post.hero_alt || post.title}
               className="w-full aspect-[16/9] object-cover" />
          {post.hero_alt && <figcaption className="text-xs text-muted mt-2 text-center">{post.hero_alt}</figcaption>}
        </figure>
      )}

      <div className="prose-magazine dropcap max-w-prose mx-auto"
           dangerouslySetInnerHTML={{ __html: post.content_html }} />

      {related.length > 0 && (
        <section className="mt-20 border-t-2 border-ink pt-8">
          <h2 className="font-display text-2xl mb-4">More in {labelFor(post.category)}</h2>
          <ul className="space-y-3">
            {related.map(r => (
              <li key={r.id}>
                <Link href={`/article/${r.slug}`} className="font-display text-lg hover:text-accent">
                  {r.title}
                </Link>
                {r.deck && <p className="text-sm text-muted">{r.deck}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function labelFor(slug) {
  if (slug === 'california') return 'California';
  if (slug === 'business') return 'Business';
  return 'National';
}
