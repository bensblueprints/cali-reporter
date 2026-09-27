#!/usr/bin/env node
// Rename existing city profiles in place; preserve IDs, slugs, articles and timestamps.
import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SECTION_DESKS, CITY_WRITER_NAMES } from '../lib/section-coverage.js';
const apply = process.argv.includes('--apply');
const path = process.env.DATABASE_PATH || './data/cali-reporter.db';
const db = new Database(path, { readonly: !apply, fileMustExist: true });
db.pragma('busy_timeout = 5000');
const changes = SECTION_DESKS.filter(d => CITY_WRITER_NAMES[d.category]).map(d => {
 const row = db.prepare("SELECT id,name,role FROM authors WHERE slug=?").get(d.slug);
 if (!row || row.role !== 'desk') throw new Error(`Expected existing city desk: ${d.slug}`);
 return { ...d, id: row.id, previousName: row.name };
});
if (apply) {
 const backupDir = join(dirname(path), 'author-backups');
 await mkdir(backupDir, { recursive: true });
 await db.backup(join(backupDir, `before-city-names-${Date.now()}.db`));
 const update = db.prepare("UPDATE authors SET name=@name,beat=@beat,bio=@bio,voice_prompt=@voice WHERE id=@id AND slug=@slug AND role='desk'");
 db.transaction(() => { for (const d of changes) { if(update.run(d).changes !== 1) throw new Error(`Profile changed during update: ${d.slug}`); } })();
}
console.log(JSON.stringify({ applied: apply, writers: changes.map(d => ({ id:d.id, slug:d.slug, previousName:d.previousName, name:d.name })) }, null, 2));
db.close();
