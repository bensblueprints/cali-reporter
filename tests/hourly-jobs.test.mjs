import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {HOUR,ensureHourlyJobs,enqueueHour,claimJob,retryJob,reserveSource,deferSource,publishJob} from '../lib/hourly-jobs.js';
const now=Date.parse('2026-09-27T12:05:00Z');
function fixture(){const db=new Database(':memory:');db.exec(`CREATE TABLE authors(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,beat TEXT,voice_prompt TEXT);
 INSERT INTO authors VALUES (1,'One','one','LA',''),(2,'Two','two','SD','');
 CREATE TABLE posts(id INTEGER PRIMARY KEY,slug TEXT UNIQUE,title TEXT,deck TEXT,content_html TEXT,hero_image TEXT,hero_alt TEXT,category TEXT,origin TEXT,source_name TEXT,source_url TEXT,source_guid TEXT UNIQUE,published_at TEXT,author_id INTEGER);`);ensureHourlyJobs(db);return db;}
const writers=[{id:1,desk:'los-angeles'},{id:2,desk:'san-diego'}];
const post=(job)=>({slug:'article-'+job.id,title:'Article',deck:null,content_html:'<p>Reviewed article</p>',hero_image:'/uploads/image.webp',hero_alt:'Illustration',category:job.category,source_name:'Publisher',source_url:'https://example.com/'+job.id,source_guid:'source-'+job.id,published_at:new Date(now).toISOString(),author_id:job.author_id});
test('failed sources cool down across writers and hours, then become eligible again',()=>{
 const db=fixture();try{
 enqueueHour(db,writers,now);const a=claimJob(db,now),b=claimJob(db,now);
 const url='https://example.com/thin';
 assert(reserveSource(db,a,url,now));deferSource(db,url,'Insufficient full source material: 40 words',now);
 retryJob(db,a,'No source',now);
 assert.equal(reserveSource(db,b,url,now+HOUR),false);
 assert.equal(reserveSource(db,b,'https://example.com/another',now+HOUR),true);
 assert.equal(reserveSource(db,b,url,now+6*HOUR),true);
 }finally{db.close();}
});
test('transient model errors only pause a source briefly and preserve history',()=>{
 const db=fixture();try{
 enqueueHour(db,writers,now);const a=claimJob(db,now);
 const url='https://example.com/retry';
 deferSource(db,url,'Article model HTTP 524',now);
 assert.equal(reserveSource(db,a,url,now+60000),false);
 assert.equal(reserveSource(db,a,url,now+300000),true);
 deferSource(db,url,'Article review: unsupported detail',now+300000);
 assert.equal(db.prepare('SELECT failures FROM hourly_source_failures WHERE url=?').get(url).failures,2);
 }finally{db.close();}
});
test('busy desks cannot consume all claims before later-ID categories get a turn',()=>{
 const db=fixture();try{
 db.exec("INSERT INTO authors VALUES (30,'City','city','Fresno','')");
 enqueueHour(db,[{id:1,desk:'california'},{id:2,desk:'california'},{id:30,desk:'fresno'}],now);
 const a=claimJob(db,now);assert.equal(a.author_id,1);
 const b=claimJob(db,now);assert.equal(b.author_id,30);
 assert.equal(claimJob(db,now).author_id,2);
 }finally{db.close();}
});
test('new hour prioritizes the section with oldest coverage rather than writer IDs',()=>{
 const db=fixture();try{
 db.prepare('INSERT INTO posts(category,published_at) VALUES (?,?)').run('los-angeles',new Date(now-60000).toISOString());
 enqueueHour(db,writers,now);
 assert.equal(claimJob(db,now).category,'san-diego');
 }finally{db.close();}
});
test('hourly slots are idempotent, scoped, and recover without duplicate publication',()=>{
 const db=fixture();try{
 assert.equal(enqueueHour(db,writers,now),2);assert.equal(enqueueHour(db,writers,now),0);
 const job=claimJob(db,now,[2]);assert.equal(job.author_id,2);assert.equal(claimJob(db,now,[2]),null);
 const draft=post(job);assert.equal(reserveSource(db,job,draft.source_url,now),true);
 const result=publishJob(db,job,draft,now);assert.equal(result.inserted,true);
 assert.throws(()=>publishJob(db,job,draft,now),/already completed/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM posts').get().n,1);
 assert.equal(enqueueHour(db,writers,now+HOUR),2);
 }finally{db.close();}
});
test('source claims prevent simultaneous duplicate stories; rejection retries with backoff',()=>{
 const db=fixture();try{
 enqueueHour(db,writers,now);const a=claimJob(db,now),b=claimJob(db,now);
 assert.equal(reserveSource(db,a,'https://example.com/story',now),true);
 assert.equal(reserveSource(db,b,'https://example.com/story',now),false);
 retryJob(db,a,'Review failed',now);assert.equal(claimJob(db,now),null);
 assert.equal(claimJob(db,now+300000).id,a.id);
 }finally{db.close();}
});
test('expired slots never publish and wrong-category drafts fail',()=>{
 const db=fixture();try{
 enqueueHour(db,writers,now);const job=claimJob(db,now);
 assert.throws(()=>publishJob(db,job,{...post(job),category:'other'},now),/mismatch/);
 assert.throws(()=>publishJob(db,job,post(job),now+HOUR),/expired/);
 claimJob(db,now+HOUR);assert.equal(db.prepare('SELECT state FROM hourly_writer_jobs WHERE id=?').get(job.id).state,'expired');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM posts').get().n,0);
 }finally{db.close();}
});
test('an existing article fills its writer slot and a late external insert cannot create a second',()=>{
 const db=fixture();try{
 enqueueHour(db,writers,now);const job=claimJob(db,now);
 db.prepare('INSERT INTO posts(author_id,published_at) VALUES (?,?)').run(job.author_id,new Date(now).toISOString());
 assert.equal(publishJob(db,job,post(job),now).inserted,false);
 db.exec('DELETE FROM hourly_writer_jobs');enqueueHour(db,writers,now);
 assert.equal(db.prepare('SELECT state FROM hourly_writer_jobs WHERE author_id=?').get(job.author_id).state,'complete');
 }finally{db.close();}
});
