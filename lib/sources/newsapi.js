// NewsAPI.org adapter — free Developer tier (100 req/day, 30-day window, 100 articles/page).
// Returns normalized articles: { title, url, source, publishedAt, summary, guid }

const ENDPOINT = 'https://newsapi.org/v2/everything';

/**
 * @param {object} args
 * @param {string} args.query   — boolean search ("Iran AND (war OR strike)")
 * @param {Date}   args.from    — earliest published_at
 * @param {Date}   args.to      — latest published_at
 * @param {number} [args.pageSize=100]
 * @param {number} [args.maxPages=2] — cap to keep within free-tier daily request budget
 * @param {string} [args.language='en']
 * @param {string} [args.sortBy='publishedAt']
 * @returns {Promise<Array<{title:string,url:string,source:string,publishedAt:string,summary:string,guid:string}>>}
 */
export async function searchNewsApi({ query, from, to, pageSize = 100, maxPages = 2, language = 'en', sortBy = 'publishedAt' }) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error('NEWSAPI_KEY not set');
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      q: query,
      from: from.toISOString(),
      to: to.toISOString(),
      pageSize: String(pageSize),
      page: String(page),
      language,
      sortBy,
    });
    const resp = await fetch(`${ENDPOINT}?${params}`, {
      headers: { 'X-Api-Key': key, 'User-Agent': 'CaliReporterBot/1.0' },
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`newsapi ${resp.status}: ${t.slice(0, 200)}`);
    }
    const j = await resp.json();
    if (j.status !== 'ok') throw new Error(`newsapi: ${j.message || j.code}`);
    for (const a of j.articles || []) {
      if (!a.url || !a.title) continue;
      out.push({
        title: a.title,
        url: a.url,
        source: a.source?.name || 'NewsAPI',
        publishedAt: a.publishedAt,
        summary: [a.description, a.content].filter(Boolean).join(' ').replace(/\[\+\d+ chars\]$/, '').trim(),
        guid: a.url,
      });
    }
    // Stop early if fewer results than pageSize (no more pages).
    if ((j.articles || []).length < pageSize) break;
  }
  return out;
}
