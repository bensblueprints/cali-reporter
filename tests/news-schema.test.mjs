import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { newsSchema, isoDate, serializeJsonLd, articleMetadata } from '../lib/news-schema.js';
import { sitemapIndex, sitemapPage, sitemapResponse } from '../lib/sitemaps.js';
const post = { slug: 'new-story', title: 'News </script><script>alert(1)</script>', deck: 'A & B', published_at: '2026-09-26T19:53:02.442Z', updated_at: '2026-09-26 19:53:02', hero_image: '/uploads/test.webp', category: 'business' };
test('UTC dates, canonical, publisher and safe JSON-LD', () => {
  assert.equal(isoDate('2026-09-26 19:53:02'), '2026-09-26T19:53:02.000Z');
  assert.equal(isoDate('invalid'), undefined);
  const data = newsSchema(post);
  assert.equal(data.dateModified, data.datePublished);
  assert.equal(data.image[0], 'https://calireporter.com/uploads/test.webp');
  assert.equal(data.author[0].name, 'Cali Reporter');
  assert.equal(data.publisher.logo.width, 600);
  const json = serializeJsonLd(data);
  assert.ok(!json.includes('<'));
  assert.deepEqual(JSON.parse(json), JSON.parse(JSON.stringify(data)));
  assert.equal(articleMetadata(post).robots['max-image-preview'], 'large');
});
test('future articles inherit author, source, dates and schema without migration', () => {
  const future = { ...post, slug: 'tomorrows-story', author_name: 'Example Writer', author_slug: 'example-writer', source_url: 'https://example.com/report', updated_at: '2026-09-27 01:00:00' };
  const data = newsSchema(future);
  assert.equal(data.author[0].url, 'https://calireporter.com/authors/example-writer');
  assert.equal(data.dateModified, '2026-09-27T01:00:00.000Z');
  assert.equal(data.citation, future.source_url);
  assert.equal(data.url, 'https://calireporter.com/article/tomorrows-story');
});
test('all archive rows, news shards, exact 48 hours, escaped XML and 30-minute cache', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE posts (id INTEGER PRIMARY KEY, slug TEXT, title TEXT, hero_image TEXT, published_at TEXT, updated_at TEXT)');
  const insert = db.prepare('INSERT INTO posts (slug,title,published_at) VALUES (?,?,?)');
  const now = new Date(Date.now() - 60000).toISOString();
  db.transaction(() => { for (let i = 0; i < 1001; i++) insert.run(`story-${i}`, 'A & B <news>', now); })();
  insert.run('old', 'Old news', new Date(Date.now()-49*3600000).toISOString());
  insert.run('scheduled', 'Tomorrow', new Date(Date.now()+86400000).toISOString());
  assert.match(sitemapIndex(db), /articles\/2.xml/);
  assert.match(sitemapIndex(db, true), /news\/2.xml/);
  const archive = sitemapPage(db,'articles','1.xml') + sitemapPage(db,'articles','2.xml');
  assert.equal((archive.match(/<url>/g)||[]).length,1002);
  assert.ok(archive.includes('/article/old'));
  assert.ok(!archive.includes('/article/scheduled'));
  const news = sitemapPage(db,'news','1.xml') + sitemapPage(db,'news','2.xml');
  assert.equal((news.match(/<news:news>/g)||[]).length,1001);
  assert.ok(!news.includes('/article/old'));
  assert.ok(news.includes('A &amp; B &lt;news&gt;'));
  for (const file of ['0.xml','-1.xml','1','01.xml','1.xml?x','999999999999.xml','3.xml']) assert.equal(sitemapPage(db,'news',file),null);
  assert.match(sitemapResponse(news).headers.get('cache-control'), /max-age=1800/);
  db.close();
});

test('editorial desk bylines use Organization identity rather than Person',()=>{
 const schema=newsSchema({slug:'desk-story',title:'Desk story',content_html:'<p>Story</p>',published_at:'2026-09-27T00:00:00Z',category:'los-angeles',author_name:'Los Angeles Desk',author_slug:'los-angeles-desk',author_role:'desk'});
 assert.equal(schema.author[0]['@type'],'Organization');
 assert.match(schema.author[0]['@id'],/#organization$/);
});
