#!/usr/bin/env node
// Persistent per-writer hourly slots. Cron polls every five minutes; jobs retry safely.
import 'dotenv/config';
import fs from 'node:fs';
import {writeReportedArticle,plainText,wordCount} from '../lib/ai/reported-article.js';
import {exitWorker} from '../lib/worker-exit.js';
import Parser from 'rss-parser';
import {getDb} from '../lib/db.js';
import {seedSectionWriters,CITY_WRITER_NAMES,relevantFeedItem} from '../lib/section-coverage.js';
import {rankLocalItems,discardImportedText} from '../lib/local-news.js';
import {ensureHourlyJobs,enqueueHour,claimJob,retryJob,reserveSource,deferSource,publishJob} from '../lib/hourly-jobs.js';
const args=new Set(process.argv.slice(2));
const option=(name,fallback)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const dry=args.has('--dry');
const scope=option('scope',process.env.HOURLY_WRITER_SCOPE||'all');
if(!['all','cities'].includes(scope))throw new Error('scope must be all or cities');
const maxJobs=Math.max(1,Math.min(100,Number(option('max-jobs','12'))));
const concurrency=Math.max(1,Math.min(2,Number(option('concurrency','2'))));
const budget=Math.max(30,Math.min(3300,Number(option('budget-seconds','240'))))*1000;
if(![maxJobs,concurrency,budget].every(Number.isFinite))throw new Error('Invalid numeric options');
const db=getDb();
if(!dry)seedSectionWriters(db);
const writers=db.prepare('SELECT * FROM authors ORDER BY id').all().filter(a=>
 scope==='cities' ? Boolean(CITY_WRITER_NAMES[a.desk]) : a.role!=='desk'||Boolean(CITY_WRITER_NAMES[a.desk]));
if(dry) {
 console.log(JSON.stringify({dry:true,scope,hour:new Date(Math.floor(Date.now()/3600000)*3600000).toISOString(),writers:writers.map(a=>({id:a.id,name:a.name,category:a.desk})),targetPerHour:writers.length},null,2));
 db.close();process.exit(0);
}
ensureHourlyJobs(db);
const enqueued=enqueueHour(db,writers);
console.log(JSON.stringify({at:new Date().toISOString(),event:'hour-enqueued',scope,enqueued,writers:writers.length}));
if(args.has('--enqueue-only')){db.close();process.exit(0);}
// Bound this worker's requests independently of the older importer configuration.
process.env.LOCALFLEET_TEXT_TIMEOUT_MS='120000';
process.env.COMFY_TIMEOUT_MS='120000';
const {generateHeroImage}=await import('../lib/ai/index.js');
const {scrapeArticle}=await import('../lib/sources/scrape.js');
const {makeSlug}=await import('../lib/format.js');
const feeds=JSON.parse(fs.readFileSync('feeds.json','utf8')).feeds;
const parser=new Parser({timeout:15000,headers:{'User-Agent':'CaliReporterBot/1.0 (+https://calireporter.com)'}});
const cache=new Map();
const fetchFeed=url=>{if(!cache.has(url))cache.set(url,parser.parseURL(url));return cache.get(url);};
const log=(event,extra)=>console.log(JSON.stringify({at:new Date().toISOString(),event,...extra}));
async function candidates(job) {
 const output=[];
 for(const feed of feeds.filter(f=>f.category===job.category)) {
  try {
   const parsed=await fetchFeed(feed.url);
   let items=parsed.items||[];
   if(CITY_WRITER_NAMES[job.category]) {
    const city=job.category.replaceAll('-',' ');
    const url=feed.trends_url||'https://news.google.com/rss/search?'+new URLSearchParams({q:`"${city}" when:2d`,hl:'en-US',gl:'US',ceid:'US:en'});
    let signals=[];
    try{signals=(await fetchFeed(url)).items||[];}catch{log('trend-unavailable',{category:job.category});}
    items=rankLocalItems(items,signals);
   }
   for(const [rank,item] of items.filter(i=>relevantFeedItem(feed,i)).entries()) {
    if(item.title&&/^https?:\/\//.test(item.link||''))output.push({feed,item:{...item},rank});
   }
  }catch(error){log('feed-error',{feed:feed.name,error:error.message});}
 }
 return output.sort((a,b)=>Number(String(b.item["content:encoded"]||b.item.content||"").length>5000)-Number(String(a.item["content:encoded"]||a.item.content||"").length>5000)||a.rank-b.rank);
}
async function work(job) {
 const available=await candidates(job);
 let tried=0,inspected=0;
 for(const {feed,item} of available) {
  if(tried>=2||inspected>=8)break;
  if(!reserveSource(db,job,item.link))continue;
  inspected++;
  let body=[item['content:encoded'],item.content,item.contentSnippet,item.summary].filter(Boolean).map(plainText).sort((a,b)=>b.length-a.length)[0]||'';
  let refImageUrl;
  try {
   try{const source=await scrapeArticle(item.link);if(source?.text?.length>body.length)body=source.text;if(source?.ogImage)refImageUrl=source.ogImage;}catch{/* A substantial RSS summary can still support a brief. */}
   if(wordCount(body)<700)throw new Error(`Insufficient full source material: ${wordCount(body)} words`);
   tried++;
   const rewritten=await writeReportedArticle({title:item.title,body,sourceName:feed.name,sourceUrl:item.link,category:job.category,author:{name:job.name,beat:job.beat},kind:'reported-article'});
   body='';discardImportedText(item);
   const hero=await generateHeroImage({title:rewritten.title,deck:rewritten.deck,category:job.category,refImageUrl});
   if(!hero?.url)throw new Error('Missing article image');
   const slug=`${makeSlug(rewritten.title)}-${job.id}`;
   const result=publishJob(db,job,{slug,title:rewritten.title,deck:rewritten.deck||null,content_html:rewritten.html,hero_image:hero.url,
    hero_alt:hero.kind==='ai-illustration'?`AI-generated illustration: ${rewritten.title}. Not a photograph of the reported event.`:`Illustrative image: ${hero.alt||rewritten.title}`,
    category:job.category,source_name:feed.name,source_url:item.link,source_guid:item.guid||item.id||item.link,published_at:new Date().toISOString(),author_id:job.author_id});
   log('article-ready',{job:job.id,author:job.name,category:job.category,words:rewritten.words,...result});return;
  }catch(error){deferSource(db,item.link,error.message);log('candidate-rejected',{job:job.id,reason:error.message});}
  finally{body='';discardImportedText(item);db.prepare('DELETE FROM hourly_source_claims WHERE url=? AND job_id=?').run(item.link,job.id);}
 }
 throw new Error(tried?'No candidate passed source/rewrite/image checks':'No unused eligible source available');
}
const start=Date.now();let claimed=0;
await Promise.all(Array.from({length:concurrency},async()=>{
 while(claimed<maxJobs&&Date.now()-start<budget){const job=claimJob(db,Date.now(),writers.map(a=>a.id));if(!job)break;claimed++;
  const heartbeat=setInterval(()=>{db.prepare("UPDATE hourly_writer_jobs SET lease_until=? WHERE id=? AND state='running'").run(Date.now()+15*60000,job.id);},30000);
  try{await work(job);}catch(error){retryJob(db,job,error.message);log('job-deferred',{job:job.id,author:job.name,reason:error.message});}
  finally{clearInterval(heartbeat);}
 }
}));
log('run-complete',{claimed,states:db.prepare('SELECT state,COUNT(*) n FROM hourly_writer_jobs WHERE slot=? GROUP BY state').all(Math.floor(Date.now()/3600000)*3600000)});
db.close();
await exitWorker();
