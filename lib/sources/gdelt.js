// GDELT 2.0 DOC API — free, no auth, multi-year archive.
// Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
// Returns normalized articles: { title, url, source, publishedAt, summary, guid }

const ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';

/**
 * @param {object} args
 * @param {string} args.query     — GDELT query string
 * @param {Date}   args.from
 * @param {Date}   args.to
 * @param {number} [args.maxRecords=75]   — GDELT cap is 250 per request
 * @param {string} [args.sourceLang='english']
 * @param {string} [args.sourceCountry='US']
 */
export async function searchGdelt({ query, from, to, maxRecords = 75, sourceLang = 'english', sourceCountry = 'US' }) {
  const filtered = `${query} sourcelang:${sourceLang} sourcecountry:${sourceCountry}`;
  const params = new URLSearchParams({
    query: filtered,
    mode: 'ArtList',
    format: 'json',
    maxrecords: String(maxRecords),
    sort: 'DateDesc',
    startdatetime: gdeltStamp(from),
    enddatetime: gdeltStamp(to),
  });
  const resp = await fetch(`${ENDPOINT}?${params}`, {
    headers: { 'User-Agent': 'CaliReporterBot/1.0' },
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`gdelt ${resp.status}: ${t.slice(0, 200)}`);
  }
  // GDELT sometimes returns an HTML error page on bad queries; sniff for JSON.
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`gdelt: non-JSON response — ${text.slice(0, 120)}`);
  }
  const out = [];
  for (const a of json.articles || []) {
    if (!a.url || !a.title) continue;
    out.push({
      title: a.title,
      url: a.url,
      source: a.domain || a.sourcecountry || 'GDELT',
      publishedAt: gdeltParseDate(a.seendate),
      summary: a.title, // GDELT ArtList doesn't return body; we'll enrich on-demand.
      guid: a.url,
      _gdelt: true,
    });
  }
  return out;
}

/**
 * Best-effort enrichment: fetch article URL, extract og:description / meta description / first <p>.
 * Quietly returns the original input on failure.
 */
export async function enrichWithMetaSummary(article, { timeoutMs = 8000 } = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(article.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaliReporterBot/1.0)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return article;
    const html = await resp.text();
    const og = pick(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']{20,})["']/i);
    const md = pick(html, /<meta\s+name=["']description["']\s+content=["']([^"']{20,})["']/i);
    const firstP = pick(html, /<p[^>]*>([\s\S]{40,400}?)<\/p>/i);
    const summary = (og || md || stripTags(firstP) || '').trim();
    if (summary.length > 50) {
      return { ...article, summary: `${article.title}. ${summary}`.slice(0, 1500) };
    }
    return article;
  } catch {
    return article;
  }
}

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// GDELT expects "YYYYMMDDHHMMSS"
function gdeltStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

// GDELT seendate: "20260408T123000Z"
function gdeltParseDate(s) {
  if (!s) return new Date().toISOString();
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)).toISOString();
}
