import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import Database from 'better-sqlite3';
import {orderFeeds,relevantFeedItem,SECTION_DESKS} from '../lib/section-coverage.js';
test('rotation reaches every section even when one section has many feeds',()=>{
 const feeds=[{category:'busy',name:'b1'},{category:'busy',name:'b2'},...SECTION_DESKS.map(d=>({category:d.category,name:d.category}))];
 const coverage=[{category:'busy',latest:'2026-09-26T00:00:00Z'}];
 const covered=[];
 for(let i=0;i<8;i++) {
   const chosen=orderFeeds(feeds,coverage)[0]; covered.push(chosen.category);
   const row=coverage.find(x=>x.category===chosen.category);
   if(row) row.latest=`2026-09-27T0${i}:00:00Z`;else coverage.push({category:chosen.category,latest:`2026-09-27T0${i}:00:00Z`});
 }
 assert.equal(new Set(covered).size,8);
 assert.equal(orderFeeds(feeds,[]).at(-1).name,'b2');
});
test('regional and relationship feeds exclude unrelated, stale and future entries',()=>{
 const feed={match:'San Jos[eé]'};const now=Date.parse('2026-09-27T00:00:00Z');
 assert.equal(relevantFeedItem(feed,{title:'San José housing',isoDate:'2026-09-26'},now),true);
 assert.equal(relevantFeedItem(feed,{title:'Santa Clara election'},now),false);
 assert.equal(relevantFeedItem(feed,{title:'San Jose',isoDate:'2020-01-01'},now),false);
 assert.equal(relevantFeedItem(feed,{title:'San Jose',isoDate:'2026-10-01'},now),false);
});
test('launch publishes exactly seven sourced posts and desk writers, and is idempotent',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cali-sections-'));const database=join(dir,'test.db');
 try {
   // Existing production newsroom schema is newer than the legacy main scaffold.
   const fixture=new Database(database);
   fixture.exec(`CREATE TABLE authors (id INTEGER PRIMARY KEY,slug TEXT UNIQUE,name TEXT,role TEXT,desk TEXT,beat TEXT,bio TEXT,voice_prompt TEXT);
     CREATE TABLE posts (id INTEGER PRIMARY KEY,slug TEXT UNIQUE,title TEXT,deck TEXT,content_html TEXT,hero_image TEXT,hero_alt TEXT,category TEXT,origin TEXT,source_name TEXT,source_url TEXT,source_guid TEXT,published_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,author_id INTEGER REFERENCES authors(id));`);
   fixture.close();
   for(let i=0;i<2;i++) execFileSync(process.execPath,['scripts/publish-section-launch.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_PATH:database},stdio:'pipe'});
   const db=new Database(database);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM posts').get().n,7);
   assert.equal(db.prepare("SELECT COUNT(*) n FROM authors WHERE role='desk'").get().n,7);
   for(const row of db.prepare('SELECT p.*,a.desk,a.bio FROM posts p JOIN authors a ON a.id=p.author_id').all()) {
     assert.equal(row.category,row.desk);assert.match(row.bio,/AI-assisted/);assert.ok(row.content_html.includes(row.source_url));
   }
   db.close();
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('model HTML cannot inject scripts, handlers or unapproved links',async()=>{
 const {cleanSectionHtml}=await import('../lib/ai/section-brief.js');
 const clean=cleanSectionHtml('<p onclick="bad()">Hello<script>alert(1)</script><a href="javascript:bad()">bad link</a><a href="https://source.example/story" onmouseover="bad()">source</a><img src=x onerror="bad()"></p>','https://source.example/story');
 assert.equal(clean,'<p>Hello<a>bad link</a><a href="https://source.example/story" rel="noopener">source</a></p>'.replace('<a>bad link</a>','bad link'));
});

test('city writer names persist across reseeding without changing article ownership or links',async()=>{
 const {seedSectionWriters,sectionWriter,CITY_WRITER_NAMES}=await import('../lib/section-coverage.js');
 const db=new Database(':memory:');
 try {
  db.exec(`CREATE TABLE authors (id INTEGER PRIMARY KEY,slug TEXT UNIQUE,name TEXT,role TEXT,desk TEXT,beat TEXT,bio TEXT,voice_prompt TEXT);
   CREATE TABLE posts (id INTEGER PRIMARY KEY,author_id INTEGER REFERENCES authors(id));`);
  seedSectionWriters(db);
  const ids={};
  for(const [city,name] of Object.entries(CITY_WRITER_NAMES)) {
   const author=sectionWriter(db,city);ids[city]=author.id;
   db.prepare('UPDATE authors SET name=? WHERE id=?').run(`${city} Desk`,author.id);
   db.prepare('INSERT INTO posts (author_id) VALUES (?)').run(author.id);
  }
  seedSectionWriters(db);seedSectionWriters(db);
  for(const [city,name] of Object.entries(CITY_WRITER_NAMES)) {
   const author=sectionWriter(db,city);
   assert.equal(author.id,ids[city]);assert.equal(author.slug,`${city}-desk`);
   assert.equal(author.name,name);assert.match(author.beat,/AI writer/);
   assert.match(author.bio,/not a human reporter/);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM posts WHERE author_id=?').get(author.id).n,1);
  }
  assert.equal(sectionWriter(db,'health').name,'Health & Nutrition Desk');
  assert.equal(sectionWriter(db,'relationships').name,'Love & Relationships Desk');
 } finally {db.close();}
});

test('city-name migration previews safely, backs up and preserves article data',async()=>{
 const {seedSectionWriters,sectionWriter}=await import('../lib/section-coverage.js');
 const {readdirSync}=await import('node:fs');
 const dir=mkdtempSync(join(tmpdir(),'cali-city-names-'));const database=join(dir,'test.db');
 try {
  const db=new Database(database);
  db.exec(`CREATE TABLE authors (id INTEGER PRIMARY KEY,slug TEXT UNIQUE,name TEXT,role TEXT,desk TEXT,beat TEXT,bio TEXT,voice_prompt TEXT);
   CREATE TABLE posts (id INTEGER PRIMARY KEY,author_id INTEGER,title TEXT,published_at TEXT);`);
  seedSectionWriters(db);
  const author=sectionWriter(db,'los-angeles');
  db.prepare('UPDATE authors SET name=? WHERE id=?').run('Los Angeles Desk',author.id);
  db.prepare('INSERT INTO posts VALUES (1,?,?,?)').run(author.id,'Existing story','2026-09-01T00:00:00Z');
  const before=db.prepare('SELECT * FROM posts').all();
  const run=(args)=>JSON.parse(execFileSync(process.execPath,['scripts/name-city-writers.js',...args],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_PATH:database}}));
  assert.equal(run([]).applied,false);
  assert.equal(sectionWriter(db,'los-angeles').name,'Los Angeles Desk');
  assert.equal(run(['--apply']).applied,true);
  assert.equal(sectionWriter(db,'los-angeles').name,'Maya Chen');
  assert.deepEqual(db.prepare('SELECT * FROM posts').all(),before);
  assert.equal(readdirSync(join(dir,'author-backups')).length,1);
  db.close();
 } finally {rmSync(dir,{recursive:true,force:true});}
});
