import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cali-reporter.db');

let _db;

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  ensureSchema(_db);
  return _db;
}

function ensureSchema(db) {
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
      origin          TEXT NOT NULL DEFAULT 'original',  -- 'original' | 'aggregated'
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
}

export const CATEGORIES = [
  { slug: 'national',   label: 'National'   },
  { slug: 'california', label: 'California' },
  { slug: 'business',   label: 'Business'   },
];

export function listPosts({ category, limit = 24, offset = 0 } = {}) {
  const db = getDb();
  if (category) {
    return db.prepare(
      `SELECT * FROM posts WHERE category = ? ORDER BY published_at DESC LIMIT ? OFFSET ?`
    ).all(category, limit, offset);
  }
  return db.prepare(
    `SELECT * FROM posts ORDER BY published_at DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
}

export function getPostBySlug(slug) {
  return getDb().prepare(`SELECT * FROM posts WHERE slug = ?`).get(slug);
}

export function getPostById(id) {
  return getDb().prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
}

export function getPostByGuid(guid) {
  if (!guid) return null;
  return getDb().prepare(`SELECT * FROM posts WHERE source_guid = ?`).get(guid);
}

export function insertPost(post) {
  const stmt = getDb().prepare(`
    INSERT INTO posts (
      slug, title, deck, content_html, hero_image, hero_alt,
      category, origin, source_name, source_url, source_guid, published_at
    ) VALUES (
      @slug, @title, @deck, @content_html, @hero_image, @hero_alt,
      @category, @origin, @source_name, @source_url, @source_guid, @published_at
    )
  `);
  const info = stmt.run({
    slug: post.slug,
    title: post.title,
    deck: post.deck || null,
    content_html: post.content_html,
    hero_image: post.hero_image || null,
    hero_alt: post.hero_alt || null,
    category: post.category || 'national',
    origin: post.origin || 'original',
    source_name: post.source_name || null,
    source_url: post.source_url || null,
    source_guid: post.source_guid || null,
    published_at: post.published_at || new Date().toISOString(),
  });
  return info.lastInsertRowid;
}

export function updatePost(id, fields) {
  const allowed = ['title','deck','content_html','hero_image','hero_alt','category','published_at'];
  const sets = [];
  const params = { id };
  for (const k of allowed) {
    if (k in fields) { sets.push(`${k} = @${k}`); params[k] = fields[k]; }
  }
  if (!sets.length) return;
  sets.push(`updated_at = datetime('now')`);
  getDb().prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

export function deletePost(id) {
  getDb().prepare(`DELETE FROM posts WHERE id = ?`).run(id);
}

export function recordAggregatorRun({ inserted, skipped, errors, log }) {
  getDb().prepare(`
    INSERT INTO aggregator_runs (finished_at, inserted, skipped, errors, log)
    VALUES (datetime('now'), ?, ?, ?, ?)
  `).run(inserted, skipped, errors, log || null);
}
