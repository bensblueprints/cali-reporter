#!/usr/bin/env node
// Pull configured RSS feeds, AI-rewrite into our voice, generate hero images, insert.
// Usage: node scripts/aggregate.js [--dry]

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Parser from 'rss-parser';
import slugify from 'slugify';
import Database from 'better-sqlite3';

import { rewriteArticle, generateHeroImage, ACTIVE_TEXT_PROVIDER, ACTIVE_IMAGE_PROVIDER } from '../lib/ai/index.js';

const DRY = process.argv.includes('--dry');
const MAX_PER_RUN = Number(process.env.AGGREGATE_MAX_PER_RUN || 12);
const MAX_PER_FEED = Number(process.env.AGGREGATE_MAX_PER_FEED || 4);

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cali-reporter.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const feedsConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'feeds.json'), 'utf8'));
const parser = new Parser({
  timeout: 20_000,
  headers: { 'User-Agent': 'CaliReporterBot/1.0 (+https://calireporter.com)' },
});

const log = (msg) => console.log(`[aggregate] ${msg}`);

log(`mode=${DRY ? 'DRY' : 'LIVE'} text=${ACTIVE_TEXT_PROVIDER} image=${ACTIVE_IMAGE_PROVIDER} max/run=${MAX_PER_RUN} max/feed=${MAX_PER_FEED}`);

const stats = { inserted: 0, skipped: 0, errors: 0, lines: [] };

function recordLog(line) { stats.lines.push(line); log(line); }

function makeSlug(title, suffix) {
  const base = slugify(String(title || '').trim(), { lower: true, strict: true }).slice(0, 80);
  const tail = suffix ? `-${suffix}` : '';
  return (base || 'post') + tail;
}

function alreadyHaveGuid(guid) {
  if (!guid) return false;
  return !!db.prepare('SELECT 1 FROM posts WHERE source_guid = ?').get(guid);
}
function alreadyHaveSlug(slug) {
  return !!db.prepare('SELECT 1 FROM posts WHERE slug = ?').get(slug);
}

function insertPost(p) {
  return db.prepare(`
    INSERT INTO posts (slug, title, deck, content_html, hero_image, hero_alt, category, origin, source_name, source_url, source_guid, published_at)
    VALUES (@slug, @title, @deck, @content_html, @hero_image, @hero_alt, @category, 'aggregated', @source_name, @source_url, @source_guid, @published_at)
  `).run(p).lastInsertRowid;
}

function recordRun() {
  db.prepare(`
    INSERT INTO aggregator_runs (finished_at, inserted, skipped, errors, log)
    VALUES (datetime('now'), ?, ?, ?, ?)
  `).run(stats.inserted, stats.skipped, stats.errors, stats.lines.join('\n'));
}

function summary(text, max = 1200) {
  if (!text) return '';
  const t = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

async function processFeed(feed) {
  if (stats.inserted >= MAX_PER_RUN) return;
  recordLog(`feed: ${feed.name}`);
  let parsed;
  try {
    parsed = await parser.parseURL(feed.url);
  } catch (err) {
    stats.errors++;
    recordLog(`  ✗ fetch error: ${err.message}`);
    return;
  }
  let perFeedCount = 0;
  for (const item of parsed.items || []) {
    if (stats.inserted >= MAX_PER_RUN) break;
    if (perFeedCount >= MAX_PER_FEED) break;

    const guid = item.guid || item.id || item.link;
    const title = (item.title || '').trim();
    const link  = item.link || '';
    if (!title || !link) { stats.skipped++; continue; }
    if (alreadyHaveGuid(guid)) { stats.skipped++; continue; }

    const slugBase = makeSlug(title);
    const slug = alreadyHaveSlug(slugBase) ? makeSlug(title, Date.now().toString(36)) : slugBase;

    const sourceSummary = summary(item.contentSnippet || item.content || item.summary || item.title);
    recordLog(`  · ${title.slice(0, 80)}`);

    if (DRY) {
      recordLog(`    [dry] would rewrite + image + insert (category=${feed.category})`);
      stats.inserted++;
      perFeedCount++;
      continue;
    }

    let rewritten;
    try {
      rewritten = await rewriteArticle({
        title,
        summary: sourceSummary,
        sourceName: feed.name,
        sourceUrl: link,
        category: feed.category,
      });
    } catch (err) {
      stats.errors++;
      recordLog(`    ✗ rewrite error: ${err.message}`);
      continue;
    }

    let hero;
    try {
      hero = await generateHeroImage({
        title,
        deck: rewritten.deck,
        category: feed.category,
      });
    } catch (err) {
      stats.errors++;
      recordLog(`    ✗ image error: ${err.message}`);
      continue;
    }

    try {
      const id = insertPost({
        slug,
        title,
        deck: rewritten.deck || null,
        content_html: rewritten.html,
        hero_image: hero.url,
        hero_alt: hero.alt || title,
        category: feed.category,
        source_name: feed.name,
        source_url: link,
        source_guid: guid,
        published_at: item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate).toISOString() : new Date().toISOString(),
      });
      stats.inserted++;
      perFeedCount++;
      recordLog(`    ✓ inserted #${id}`);
    } catch (err) {
      stats.errors++;
      recordLog(`    ✗ insert error: ${err.message}`);
    }
  }
}

const startedAt = Date.now();
for (const feed of feedsConfig.feeds) {
  if (stats.inserted >= MAX_PER_RUN) break;
  await processFeed(feed);
}

recordLog(`done — inserted=${stats.inserted} skipped=${stats.skipped} errors=${stats.errors} took=${Math.round((Date.now()-startedAt)/1000)}s`);
if (!DRY) recordRun();
db.close();
process.exit(stats.errors > 0 && stats.inserted === 0 ? 1 : 0);
