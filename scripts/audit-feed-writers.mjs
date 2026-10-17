#!/usr/bin/env node
import fs from 'node:fs';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import {exitWorker} from '../lib/worker-exit.js';
const db=new Database(process.env.DATABASE_PATH || 'data/cali-reporter.db',{readonly:true});
const writers=db.prepare("SELECT name,desk,beat,voice_prompt FROM authors WHERE role!='desk' OR desk IN ('los-angeles','san-diego','san-jose','san-francisco','fresno') ORDER BY desk,id").all();
db.close();
const parser=new Parser({timeout:20000,headers:{'User-Agent':'CaliReporterBot/1.0 (+https://calireporter.com)'}});
const feeds=JSON.parse(fs.readFileSync('feeds.json','utf8')).feeds;
const checks=[];
for(let i=0;i<feeds.length;i+=4) checks.push(...await Promise.all(feeds.slice(i,i+4).map(async feed=>{
  try {
    const parsed=await parser.parseURL(feed.url);
    return {...feed,ok:true,items:parsed.items.length,latest:parsed.items[0]?.isoDate||parsed.items[0]?.pubDate||null};
  }catch(error){return {...feed,ok:false,error:error.message};}
})));
const report={at:new Date().toISOString(),categories:[...new Set(writers.map(w=>w.desk))].map(category=>({category,
  writers:writers.filter(w=>w.desk===category).map(({name,beat,voice_prompt})=>({name,beat,voice:voice_prompt})),
  feeds:checks.filter(f=>f.category===category)}))};
console.log(JSON.stringify(report,null,2));
await exitWorker(report.categories.some(c=>!c.feeds.some(f=>f.ok&&f.items))?1:0);
