#!/usr/bin/env node
// Cali Reporter — historical backfill.
// Pulls real articles from NewsAPI (last 30 days) + GDELT (31-90 days back),
// rewrites in the configured voice, generates hero images, inserts with REAL published_at.
//
// Usage:
//   node scripts/backfill.js                         # default: target 300, all themes
//   node scripts/backfill.js --dry                   # plan only, no API calls
//   node scripts/backfill.js --limit 50              # cap total inserts
//   node scripts/backfill.js --theme iran-war        # one theme
//   node scripts/backfill.js --no-images             # skip hero generation (fast/cheap)
//   node scripts/backfill.js --voice freepress       # override AI_VOICE for this run

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import fs from 'node:fs';
import path from 'node:path';
import slugify from 'slugify';
import Database from 'better-sqlite3';

import { searchNewsApi } from '../lib/sources/newsapi.js';
import { searchGdelt, enrichWithMetaSummary } from '../lib/sources/gdelt.js';
import { rewriteArticle, generateHeroImage, ACTIVE_TEXT_PROVIDER, ACTIVE_IMAGE_PROVIDER } from '../lib/ai/index.js';
import { imageNone } from '../lib/ai/none.js';
import { activeVoice } from '../lib/ai/voices.js';

// --- args ---
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const NO_IMAGES = args.includes('--no-images');
const LIMIT = numArg('--limit', null);
const THEME_FILTER = strArg('--theme', null);
const VOICE_OVERRIDE = strArg('--voice', null);
if (VOICE_OVERRIDE) process.env.AI_VOICE = VOICE_OVERRIDE;

function numArg(name, def) { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : def; }
function strArg(name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; }

// --- setup ---
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cali-reporter.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'queries.json'), 'utf8'));
const themes = THEME_FILTER ? config.themes.filter(t => t.key === THEME_FILTER) : config.themes;
if (THEME_FILTER && themes.length === 0) {
  console.error(`unknown theme: ${THEME_FILTER}. valid: ${config.themes.map(t => t.key).join(', ')}`);
  process.exit(2);
}

const TOTAL_TARGET = LIMIT ?? themes.reduce((a, t) => a + t.target, 0);

console.log(`[backfill] mode=${DRY ? 'DRY' : 'LIVE'} text=${ACTIVE_TEXT_PROVIDER} image=${NO_IMAGES ? 'OFF' : ACTIVE_IMAGE_PROVIDER} voice=${activeVoice().label} target=${TOTAL_TARGET}`);

const stats = { fetched: 0, inserted: 0, skipped: 0, errors: 0 };

// --- date windows ---
const now = new Date();
const day = (n) => new Date(now.getTime() - n * 86400000);
const NEWSAPI_FROM = day(30);
const NEWSAPI_TO = now;
const GDELT_FROM = day(90);
const GDELT_TO = day(31);

// --- helpers ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Title-only relevance filter — strict per theme. Prevents stray-keyword matches
// from body text from misfiling articles into the wrong section.
// Each theme has a REQUIRED regex; the article's TITLE must match at least once.
const RELEVANCE = {
  // Iran war / Israel / Middle East strikes
  'iran-war':
    /\b(iran(ian)?|tehran|irgc|houthi|israel(i)?|netanyahu|hamas|hezbollah|gaza|west bank|strait of hormuz|persian gulf|middle east|nuclear deal|jcpoa)\b/i,

  // Newsom + CA state-level politics — require an explicit political signal in the title
  'newsom-california-politics':
    /\b(newsom|gavin|california governor|california legislature|sacramento|state senate|state assembly|california bill|california law|california ballot|prop\.? ?\d+|california attorney general|kamala|ca democrat|ca republican)\b/i,

  // Wildfires — require strong fire-domain words (not generic "fire" or "LA")
  'california-fires':
    /\b(wildfire|wild fire|cal\s?fire|firefighter|fire crew|fire chief|fire season|fire perimeter|fire investigation|burn(ed|ing|out) (zone|area|scar|control)|brush fire|forest fire|palisades fire|eaton fire|santa ana wind|red flag warning|evacuat(e|ed|ion|ions)|blaze|firestorm)\b/i,

  // AI datacenters — require AI/datacenter-specific phrasing, not generic "compute" or "grid"
  'ai-datacenter':
    /\b(data\s?center|hyperscaler|hyperscale|stargate|nvidia|openai|anthropic|h100|a100|gpu (cluster|farm|build)|ai (chip|infrastructure|build-?out|capacity|training)|server farm|colocation|colo facility)\b/i,
};

function isRelevant(article, themeKey) {
  const re = RELEVANCE[themeKey];
  if (!re) return true;
  // TITLE-ONLY match. Stricter but cuts noise.
  return re.test(article.title);
}

function makeSlug(title, suffix) {
  const base = slugify(String(title || '').trim(), { lower: true, strict: true }).slice(0, 80);
  const tail = suffix ? `-${suffix}` : '';
  return (base || 'post') + tail;
}
function alreadyHaveGuid(guid) { return !!db.prepare('SELECT 1 FROM posts WHERE source_guid = ?').get(guid); }
function alreadyHaveSlug(s) { return !!db.prepare('SELECT 1 FROM posts WHERE slug = ?').get(s); }
function alreadyHaveTitle(title) {
  return !!db.prepare('SELECT 1 FROM posts WHERE LOWER(title) = LOWER(?)').get(title);
}
function dedupeBy(arr, keyFn) {
  const seen = new Set(); const out = [];
  for (const a of arr) {
    const k = keyFn(a);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(a);
  }
  return out;
}

const insertStmt = db.prepare(`
  INSERT INTO posts (slug, title, deck, content_html, hero_image, hero_alt, category, origin, source_name, source_url, source_guid, published_at)
  VALUES (@slug, @title, @deck, @content_html, @hero_image, @hero_alt, @category, 'aggregated', @source_name, @source_url, @source_guid, @published_at)
`);

async function gather(theme) {
  console.log(`\n[backfill] theme=${theme.key} target=${theme.target} category=${theme.category}`);
  const collected = [];

  // --- NewsAPI: last 30 days ---
  if (process.env.NEWSAPI_KEY) {
    for (const q of theme.queries) {
      try {
        const items = await searchNewsApi({
          query: q,
          from: NEWSAPI_FROM,
          to: NEWSAPI_TO,
          pageSize: 100,
          maxPages: 1,
        });
        console.log(`  newsapi[${q.slice(0, 40)}…]: ${items.length}`);
        collected.push(...items);
      } catch (err) {
        console.warn(`  newsapi error on "${q.slice(0, 40)}": ${err.message}`);
        stats.errors++;
      }
    }
  } else {
    console.warn('  NEWSAPI_KEY not set — skipping NewsAPI window');
  }

  // --- GDELT: 31-90 days back. Rate-limit: 1 req / 5s. ---
  for (const q of theme.gdeltQueries) {
    try {
      const items = await searchGdelt({
        query: q,
        from: GDELT_FROM,
        to: GDELT_TO,
        maxRecords: 75,
      });
      console.log(`  gdelt[${q.slice(0, 40)}…]: ${items.length}`);
      collected.push(...items);
    } catch (err) {
      console.warn(`  gdelt error on "${q.slice(0, 40)}": ${err.message}`);
      stats.errors++;
    }
    await sleep(7000); // GDELT enforces ~1 req / 5s but is stricter on bursts
  }

  const dedupedByUrl = dedupeBy(collected, a => a.url);
  const relevant = dedupedByUrl.filter(a => isRelevant(a, theme.key));
  const newOnly = relevant.filter(a => !alreadyHaveGuid(a.url) && !alreadyHaveTitle(a.title));
  newOnly.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const trimmed = newOnly.slice(0, theme.target);
  console.log(`  collected=${collected.length} unique=${dedupedByUrl.length} relevant=${relevant.length} new=${newOnly.length} kept=${trimmed.length}`);
  return trimmed.map(a => ({ ...a, _theme: theme }));
}

async function processOne(article) {
  const theme = article._theme;
  let summary = article.summary;
  if (article._gdelt && summary && summary.length < 80) {
    const enriched = await enrichWithMetaSummary(article).catch(() => article);
    summary = enriched.summary || summary;
  }

  const slugBase = makeSlug(article.title);
  const slug = alreadyHaveSlug(slugBase) ? makeSlug(article.title, Date.now().toString(36)) : slugBase;

  console.log(`  · [${theme.key}] ${article.title.slice(0, 70)}`);

  if (DRY) {
    console.log(`    [dry] would rewrite + ${NO_IMAGES ? 'skip image' : 'image'} + insert (date=${article.publishedAt})`);
    stats.inserted++;
    return;
  }

  let rewritten;
  try {
    rewritten = await rewriteArticle({
      title: article.title,
      summary,
      sourceName: article.source,
      sourceUrl: article.url,
      category: theme.category,
    });
  } catch (err) {
    console.warn(`    ✗ rewrite: ${err.message}`);
    stats.errors++;
    return;
  }

  let hero;
  if (NO_IMAGES) {
    hero = imageNone({ title: article.title, category: theme.category });
  } else {
    try {
      hero = await generateHeroImage({
        title: article.title,
        deck: rewritten.deck,
        category: theme.category,
      });
    } catch (err) {
      console.warn(`    ✗ image: ${err.message}`);
      stats.errors++;
      return;
    }
  }

  try {
    insertStmt.run({
      slug,
      title: article.title,
      deck: rewritten.deck || null,
      content_html: rewritten.html,
      hero_image: hero.url,
      hero_alt: hero.alt || article.title,
      category: theme.category,
      source_name: article.source,
      source_url: article.url,
      source_guid: article.url,
      published_at: article.publishedAt || new Date().toISOString(),
    });
    stats.inserted++;
    console.log(`    ✓ inserted`);
  } catch (err) {
    console.warn(`    ✗ insert: ${err.message}`);
    stats.errors++;
  }
}

const startedAt = Date.now();
const queueByTheme = new Map();
for (const t of themes) {
  const items = await gather(t);
  stats.fetched += items.length;
  queueByTheme.set(t.key, items);
}

// Cross-theme dedupe: if the same URL/title got pulled into two themes
// (e.g. "Newsom AI datacenter bill"), keep it only in the theme that gathered it first.
const seenUrls = new Set();
const seenTitles = new Set();
const queue = [];
for (const t of themes) {
  for (const a of queueByTheme.get(t.key) || []) {
    const titleKey = a.title.toLowerCase().slice(0, 100);
    if (seenUrls.has(a.url) || seenTitles.has(titleKey)) { stats.skipped++; continue; }
    seenUrls.add(a.url); seenTitles.add(titleKey);
    queue.push(a);
  }
}
console.log(`\n[backfill] fetched=${stats.fetched}, processing up to ${TOTAL_TARGET}…\n`);

// Cap to target, interleave themes so we don't drain one before another.
const interleaved = interleave(themes.map(t => queue.filter(q => q._theme.key === t.key))).slice(0, TOTAL_TARGET);
console.log(`[backfill] post-dedupe queue: ${queue.length}, interleaved processing: ${interleaved.length}`);

for (const a of interleaved) {
  if (stats.inserted >= TOTAL_TARGET) break;
  await processOne(a);
}

console.log(`\n[backfill] done — fetched=${stats.fetched} inserted=${stats.inserted} errors=${stats.errors} took=${Math.round((Date.now()-startedAt)/1000)}s`);
db.close();
process.exit(stats.errors > 0 && stats.inserted === 0 ? 1 : 0);

function interleave(arrays) {
  const out = []; let added;
  do {
    added = false;
    for (const a of arrays) { const next = a.shift(); if (next) { out.push(next); added = true; } }
  } while (added);
  return out;
}
