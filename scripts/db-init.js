#!/usr/bin/env node
// Initialize the SQLite DB and seed a welcome post if empty.
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cali-reporter.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    deck            TEXT,
    content_html    TEXT NOT NULL,
    hero_image      TEXT,
    hero_alt        TEXT,
    category        TEXT NOT NULL DEFAULT 'national',
    origin          TEXT NOT NULL DEFAULT 'original',
    source_name     TEXT,
    source_url      TEXT,
    source_guid     TEXT,
    published_at    TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_posts_category    ON posts(category);
  CREATE INDEX IF NOT EXISTS idx_posts_published   ON posts(published_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_posts_guid ON posts(source_guid) WHERE source_guid IS NOT NULL;

  CREATE TABLE IF NOT EXISTS aggregator_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at  TEXT,
    inserted     INTEGER NOT NULL DEFAULT 0,
    skipped      INTEGER NOT NULL DEFAULT 0,
    errors       INTEGER NOT NULL DEFAULT 0,
    log          TEXT
  );
`);

const count = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
if (count === 0) {
  db.prepare(`
    INSERT INTO posts (slug, title, deck, content_html, hero_image, hero_alt, category, origin, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'welcome-to-cali-reporter',
    'Welcome to Cali Reporter',
    'A magazine-style daily on national headlines, California politics and culture, and West Coast business.',
    `<p>This is a placeholder post. Run <code>npm run aggregate</code> to pull from the configured RSS feeds, or sign in at <code>/admin/login</code> to publish your own.</p>
     <p>The site refreshes three times a day at 7:30 AM, 12:30 PM, and 6:30 PM Pacific.</p>`,
    'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=1600&q=80',
    'Coastal California cliffs at sunset',
    'national',
    'original',
  );
  console.log('[db-init] seeded welcome post');
} else {
  console.log(`[db-init] db ready — ${count} existing posts`);
}

console.log(`[db-init] DB path: ${DB_PATH}`);
db.close();
