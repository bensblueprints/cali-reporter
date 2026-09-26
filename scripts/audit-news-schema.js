// Read-only audit of every stored article; no publishing or date changes.
import Database from 'better-sqlite3';
import { newsSchema, serializeJsonLd } from '../lib/news-schema.js';
const db = new Database(process.env.DATABASE_PATH || './data/cali-reporter.db', { readonly: true });
const authors = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='authors'").get();
const posts = db.prepare(authors ? 'SELECT p.*, a.name AS author_name, a.slug AS author_slug FROM posts p LEFT JOIN authors a ON a.id=p.author_id' : 'SELECT * FROM posts').all();
const failures = [];
for (const p of posts) {
  const data = newsSchema(p);
  const errors = [];
  if (!data.headline || !p.slug) errors.push('missing title/slug');
  if (!data.datePublished || !data.dateModified) errors.push('invalid dates');
  if (!data.image?.length) errors.push('missing image');
  if (data.dateModified < data.datePublished) errors.push('modified before published');
  const encoded = serializeJsonLd(data);
  if (encoded.includes('<') || JSON.parse(encoded)['@type'] !== 'NewsArticle') errors.push('unsafe schema');
  if (errors.length) failures.push({ id: p.id, slug: p.slug, errors });
}
console.log(JSON.stringify({ articles: posts.length, valid: posts.length - failures.length, failures }, null, 2));
db.close();
if (failures.length) process.exitCode = 1;
