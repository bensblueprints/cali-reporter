#!/usr/bin/env node
// Idempotent, reviewed launch articles. Publication timestamps reflect the actual insertion.
import 'dotenv/config';
import fs from 'node:fs';
import { getDb } from '../lib/db.js';
import { seedSectionWriters, sectionWriter, SECTION_DESKS } from '../lib/section-coverage.js';
const articles = JSON.parse(fs.readFileSync(new URL('./section-launch-articles.json', import.meta.url), 'utf8'));
const categories = new Set(SECTION_DESKS.map(d => d.category));
for (const a of articles) {
  if (!categories.has(a.category) || !a.title || !a.content_html.includes(a.source_url)) throw new Error('Invalid launch article');
}
if (new Set(articles.map(a => a.category)).size !== 7 || articles.length !== 7) throw new Error('Expected seven sections');
if (process.argv.includes('--dry')) { console.log(JSON.stringify(articles.map(({category,title,slug}) => ({category,title,slug})), null, 2)); process.exit(0); }
const db = getDb();
const insert = db.prepare(`INSERT INTO posts (slug,title,deck,content_html,category,origin,source_name,source_url,source_guid,published_at,author_id)
 VALUES (@slug,@title,@deck,@content_html,@category,'original',@source_name,@source_url,@source_guid,@published_at,@author_id)
 ON CONFLICT(source_guid) WHERE source_guid IS NOT NULL DO NOTHING`);
db.transaction(() => {
  seedSectionWriters(db);
  for (const a of articles) {
    const result = insert.run({...a, source_guid:`calireporter:section-launch:${a.slug}`,
      published_at:new Date().toISOString(),author_id:sectionWriter(db,a.category).id});
    console.log(`${result.changes ? 'published' : 'already published'} ${a.category}: /article/${a.slug}`);
  }
})();
db.close();
