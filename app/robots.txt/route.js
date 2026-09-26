// robots.txt — explicitly welcomes search AND AI crawlers, points to all feeds.
export const dynamic = 'force-dynamic';

export async function GET() {
  const SITE = (process.env.SITE_URL || 'https://calireporter.com').replace(/\/$/, '');

  const aiBots = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
    'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
    'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'Applebot-Extended', 'Meta-ExternalAgent',
    'DuckAssistBot', 'Bytespider', 'cohere-ai', 'Amazonbot',
  ];

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/admin',
    '',
    ...aiBots.flatMap(b => [`User-agent: ${b}`, 'Allow: /', 'Disallow: /admin', 'Disallow: /api/admin', '']),
    `Sitemap: ${SITE}/sitemap.xml`,
    `Sitemap: ${SITE}/sitemap-news.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
