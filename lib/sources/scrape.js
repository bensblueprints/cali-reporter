// Article scraper — fetch a URL, extract clean body text + hero image
// using Mozilla Readability. Returns null on paywall/403/timeout/empty.

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const UA = 'Mozilla/5.0 (compatible; CaliReporterBot/1.0; +https://calireporter.com)';
const TIMEOUT_MS = 12_000;
const MIN_USEFUL_CHARS = 600;
const MAX_KEEP_CHARS = 8000;

/**
 * @param {string} url
 * @returns {Promise<{text:string, byline:string|null, siteName:string|null, ogImage:string|null}|null>}
 *   Returns null if scrape failed or extracted body was too short to be useful.
 */
export async function scrapeArticle(url) {
  let html;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;            // 403/404/etc.
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    html = await resp.text();
  } catch {
    return null;
  }

  // Quick paywall sniff — if the body is tiny it's likely a 200-OK paywall stub.
  if (html.length < 2000) return null;

  let dom;
  try {
    dom = new JSDOM(html, { url, pretendToBeVisual: false, runScripts: 'outside-only' });
  } catch {
    return null;
  }

  // Pull og:image while we have the DOM.
  let ogImage = null;
  try {
    const og = dom.window.document.querySelector('meta[property="og:image"]');
    if (og) ogImage = og.getAttribute('content');
  } catch {}

  let article;
  try {
    article = new Readability(dom.window.document).parse();
  } catch {
    return null;
  }
  if (!article) return null;

  const text = String(article.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_USEFUL_CHARS) return null;

  return {
    text: text.slice(0, MAX_KEEP_CHARS),
    byline: article.byline || null,
    siteName: article.siteName || null,
    ogImage,
  };
}
