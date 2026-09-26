import { articleUrl, absoluteUrl, isoDate, siteUrl } from './news-schema.js';
export const PAGE_SIZE = 1000;
export const xmlEscape = value => String(value).replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
const prefix = '<?xml version="1.0" encoding="UTF-8"?>\n';
const eligible = "julianday(published_at) <= julianday('now')";
const recent = `${eligible} AND julianday(published_at) >= julianday('now', '-2 days')`;
export function sitemapResponse(xml, status = 200) {
  return new Response(xml, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=1800' } });
}
export function sitemapIndex(db, news = false, site = siteUrl()) {
  const count = db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${news ? recent : eligible}`).get().n;
  const urls = news ? [] : [`${site}/sitemap-pages.xml`];
  for (let page = 1; page <= Math.ceil(count / PAGE_SIZE); page++) urls.push(`${site}/sitemaps/${news ? 'news' : 'articles'}/${page}.xml`);
  return prefix + `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`).join('')}</sitemapindex>`;
}
export function sitemapPage(db, kind, file, site = siteUrl()) {
  if (!['articles', 'news'].includes(kind) || !/^[1-9]\d{0,6}\.xml$/.test(file)) return null;
  const page = Number(file.slice(0, -4));
  const news = kind === 'news';
  const rows = db.prepare(`SELECT slug, title, hero_image, published_at, updated_at FROM posts WHERE ${news ? recent : eligible} ORDER BY id ASC LIMIT ? OFFSET ?`).all(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  if (!rows.length) return null;
  return prefix + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">` + rows.map(p => {
    const published = isoDate(p.published_at);
    const modified = isoDate(p.updated_at);
    const date = modified && modified > published ? modified : published;
    const image = absoluteUrl(p.hero_image, site);
    return `<url><loc>${xmlEscape(articleUrl(p, site))}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}${image ? `<image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>` : ''}${news ? `<news:news><news:publication><news:name>Cali Reporter</news:name><news:language>en</news:language></news:publication><news:publication_date>${published}</news:publication_date><news:title>${xmlEscape(p.title)}</news:title></news:news>` : ''}</url>`;
  }).join('') + '</urlset>';
}
export function pagesSitemap(db, categories, site = siteUrl()) {
  const paths = ['/', '/masthead', '/about', '/contact', '/advertise', '/sponsored-content', '/ethics', '/privacy', '/terms', ...categories.map(c => `/category/${encodeURIComponent(c.slug)}`)];
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='authors'").get()) paths.push(...db.prepare('SELECT slug FROM authors').all().map(a => `/authors/${encodeURIComponent(a.slug)}`));
  return prefix + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${xmlEscape(site + path)}</loc></url>`).join('')}</urlset>`;
}
