import Link from 'next/link';
import { excerpt, timeAgo } from '../lib/format.js';

export default function ArticleCard({ post, variant = 'default' }) {
  if (!post) return null;
  if (variant === 'lead') return <LeadCard post={post} />;
  if (variant === 'compact') return <CompactCard post={post} />;
  return <DefaultCard post={post} />;
}

function LeadCard({ post }) {
  return (
    <article className="grid gap-6 md:grid-cols-12 md:items-center">
      <Link href={`/article/${post.slug}`} className="md:col-span-7 block group">
        {post.hero_image && (
          <div className="aspect-[16/10] overflow-hidden bg-rule">
            <img src={post.hero_image} alt={post.hero_alt || post.title}
                 className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          </div>
        )}
      </Link>
      <div className="md:col-span-5">
        <CategoryEyebrow category={post.category} />
        <h2 className="mt-2 font-display text-3xl sm:text-4xl leading-tight">
          <Link href={`/article/${post.slug}`} className="hover:text-accent">{post.title}</Link>
        </h2>
        {post.deck && <p className="mt-3 text-lg text-muted leading-snug">{post.deck}</p>}
        <Meta post={post} />
      </div>
    </article>
  );
}

function DefaultCard({ post }) {
  return (
    <article className="flex flex-col">
      <Link href={`/article/${post.slug}`} className="block group">
        {post.hero_image && (
          <div className="aspect-[16/10] overflow-hidden bg-rule mb-3">
            <img src={post.hero_image} alt={post.hero_alt || post.title}
                 className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          </div>
        )}
      </Link>
      <CategoryEyebrow category={post.category} />
      <h3 className="mt-1 font-display text-xl leading-snug">
        <Link href={`/article/${post.slug}`} className="hover:text-accent">{post.title}</Link>
      </h3>
      {post.deck
        ? <p className="mt-1 text-sm text-muted line-clamp-3">{post.deck}</p>
        : <p className="mt-1 text-sm text-muted line-clamp-3">{excerpt(post.content_html, 160)}</p>}
      <Meta post={post} />
    </article>
  );
}

function CompactCard({ post }) {
  return (
    <article className="flex gap-3 py-3 border-b border-rule">
      {post.hero_image && (
        <Link href={`/article/${post.slug}`} className="shrink-0 block">
          <img src={post.hero_image} alt={post.hero_alt || post.title}
               className="h-20 w-20 object-cover" />
        </Link>
      )}
      <div className="min-w-0">
        <CategoryEyebrow category={post.category} />
        <h4 className="font-display text-base leading-tight">
          <Link href={`/article/${post.slug}`} className="hover:text-accent">{post.title}</Link>
        </h4>
        <Meta post={post} small />
      </div>
    </article>
  );
}

function Meta({ post, small }) {
  const cls = small ? 'text-[11px]' : 'text-xs';
  return (
    <div className={`mt-2 ${cls} uppercase tracking-widest text-muted`}>
      {timeAgo(post.published_at)}
      {post.origin === 'aggregated' && post.source_name && (
        <> · via {post.source_name}</>
      )}
    </div>
  );
}

function CategoryEyebrow({ category }) {
  const label = category === 'california' ? 'California' : category === 'business' ? 'Business' : 'National';
  return <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">{label}</span>;
}
