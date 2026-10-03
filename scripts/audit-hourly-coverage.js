#!/usr/bin/env node
// Read-only coverage/length report; includes sections with zero publications.
import {getDb} from '../lib/db.js';
import {plainText,wordCount,MIN_WORDS,MAX_WORDS} from '../lib/ai/reported-article.js';
import {exitWorker} from '../lib/worker-exit.js';
const sinceArg=process.argv.find(a=>a.startsWith('--since='))?.slice(8);
const since=sinceArg?new Date(sinceArg):new Date(Date.now()-86400000);
if(!Number.isFinite(since.getTime()))throw new Error('Invalid --since date');
const db=getDb();
const rows=db.prepare('SELECT DISTINCT desk AS category FROM authors ORDER BY desk').all().map(({category})=>{
 const posts=db.prepare('SELECT content_html FROM posts WHERE category=? AND julianday(published_at)>=julianday(?)').all(category,since.toISOString());
 const words=posts.map(p=>wordCount(plainText(p.content_html)));
 const latest=db.prepare('SELECT MAX(published_at) latest FROM posts WHERE category=?').get(category).latest;
 const jobs=db.prepare('SELECT state,COUNT(*) n FROM hourly_writer_jobs WHERE category=? AND slot>=? GROUP BY state').all(category,since.getTime());
 return {category,published:posts.length,minWords:words.length?Math.min(...words):null,maxWords:words.length?Math.max(...words):null,
   outsideRange:words.filter(n=>n<MIN_WORDS||n>MAX_WORDS).length,latest,jobs};
});
console.log(JSON.stringify({since:since.toISOString(),requiredWords:[MIN_WORDS,MAX_WORDS],categories:rows},null,2));
db.close();await exitWorker();
