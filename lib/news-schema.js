import { excerpt } from './format.js';
export const siteUrl = () => (process.env.SITE_URL || 'https://calireporter.com').replace(/\/$/, '');
export function isoDate(value) {
  if (!value) return undefined;
  let s = String(value).trim();
  if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const date = new Date(s);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
export function absoluteUrl(value, site = siteUrl()) {
  if (!value) return undefined;
  try { const url = new URL(value, site); return /^https?:$/.test(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export const articleUrl = (post, site = siteUrl()) => `${site}/article/${encodeURIComponent(post.slug)}`;
export function newsSchema(post, section = post.category, site = siteUrl()) {
  const url = articleUrl(post, site);
  const published = isoDate(post.published_at);
  const updated = isoDate(post.updated_at);
  const image = absoluteUrl(post.hero_image, site);
  const publisher = { '@type': 'NewsMediaOrganization', '@id': `${site}/#publisher`, name: 'Cali Reporter', url: site, logo: { '@type': 'ImageObject', url: `${site}/logo.png`, width: 600, height: 80 } };
  return {
    '@context': 'https://schema.org', '@type': 'NewsArticle', '@id': `${url}#article`, url,
    headline: post.title, description: post.deck || excerpt(post.content_html, 160),
    image: image ? [image] : undefined,
    datePublished: published, dateModified: updated && (!published || updated > published) ? updated : published,
    author: post.author_name ? [{ '@type': 'Person', name: post.author_name,
      ...(post.author_slug ? { '@id': `${site}/authors/${encodeURIComponent(post.author_slug)}#person`, url: `${site}/authors/${encodeURIComponent(post.author_slug)}` } : {}) }] : [publisher],
    publisher, mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: section, inLanguage: 'en-US', isAccessibleForFree: true,
    ...(post.source_url && absoluteUrl(post.source_url, site) ? { citation: absoluteUrl(post.source_url, site) } : {}),
    ...(post.sponsored && post.sponsor_name ? { sponsor: { '@type': 'Organization', name: post.sponsor_name } } : {}),
  };
}
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export function articleMetadata(post, section) {
  const data = newsSchema(post, section);
  return { title: post.title, description: data.description, alternates: { canonical: data.url },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: { title: post.title, description: data.description, url: data.url, type: 'article', siteName: 'Cali Reporter',
      images: data.image?.map(url => ({ url, alt: post.hero_alt || post.title })) || [],
      publishedTime: data.datePublished, modifiedTime: data.dateModified, section: data.articleSection,
      authors: data.author.map(a => a.url).filter(Boolean) },
    twitter: { card: 'summary_large_image', title: post.title, description: data.description, images: data.image || [] },
  };
}
