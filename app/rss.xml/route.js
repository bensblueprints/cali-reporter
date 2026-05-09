import { listPosts } from '../../lib/db.js';
import { excerpt } from '../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const SITE = (process.env.SITE_URL || 'https://calireporter.com').replace(/\/$/, '');
  const posts = listPosts({ limit: 50 });

  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE}/article/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/article/${p.slug}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <category>${escapeXml(labelFor(p.category))}</category>
      <description><![CDATA[${p.deck || excerpt(p.content_html, 200)}]]></description>
      ${p.hero_image ? `<enclosure url="${SITE}${p.hero_image.startsWith('http') ? '' : ''}${p.hero_image}" type="image/jpeg"/>` : ''}
    </item>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cali Reporter</title>
    <link>${SITE}/</link>
    <description>National, California, and West Coast business news. Updated 3× daily.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({
    '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'
  }[c]));
}

function labelFor(slug) {
  if (slug === 'california') return 'California';
  if (slug === 'business') return 'Business';
  return 'National';
}
