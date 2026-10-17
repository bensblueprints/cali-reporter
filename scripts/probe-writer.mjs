#!/usr/bin/env node
// Unpublished, production-client canary; never inserts a post or reserves a job.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import {writeReportedArticle,plainText,wordCount,completion} from '../lib/ai/reported-article.js';
import {scrapeArticle} from '../lib/sources/scrape.js';
import {relevantFeedItem} from '../lib/section-coverage.js';
const category=process.argv[2] || 'health';
const db=new Database(process.env.DATABASE_PATH || 'data/cali-reporter.db',{readonly:true});
const author=db.prepare('SELECT name,beat,voice_prompt AS voice FROM authors WHERE desk=? ORDER BY id LIMIT 1').get(category);
db.close();
const parser=new Parser({timeout:15000});
const feeds=JSON.parse(fs.readFileSync(process.env.PROBE_FEEDS_PATH || 'feeds.json','utf8')).feeds.filter(f=>f.category===category);
const minimumSource=Number(process.env.PROBE_MIN_SOURCE_WORDS || 700);
for(const feed of feeds) {
  let items;
  try {items=(await parser.parseURL(feed.url)).items;} catch(error){console.log(JSON.stringify({feed:feed.name,error:error.message}));continue;}
  for(const item of items.filter(item=>relevantFeedItem(feed,item)).slice(0,8)) {
    let body=[item['content:encoded'],item.content,item.contentSnippet].filter(Boolean).map(plainText).sort((a,b)=>b.length-a.length)[0] || '';
    try {const source=await scrapeArticle(item.link);if(source?.text?.length>body.length)body=source.text;}catch{}
    if(wordCount(body)<minimumSource)continue;
    console.log(JSON.stringify({event:'canary-start',category,author:author?.name,source:item.link,sourceWords:wordCount(body)}));
    const input={title:item.title,body,sourceName:feed.name,sourceUrl:item.link,sourcePublishedAt:item.isoDate||item.pubDate,category,author};
    fs.writeFileSync('/tmp/cali-writer-canary-source.json',JSON.stringify(input,null,2));
    const result=await writeReportedArticle(input,async(messages,tokens)=>{
      const response=await completion(messages,tokens);
      fs.writeFileSync('/tmp/cali-writer-canary-last-response.json',JSON.stringify(response,null,2));
      return response;
    });
    fs.writeFileSync('/tmp/cali-writer-canary.json',JSON.stringify({category,author,source:item.link,...result},null,2));
    console.log(JSON.stringify({event:'canary-passed',words:result.words,title:result.title,output:'/tmp/cali-writer-canary.json'}));
    process.exit(0);
  }
}
throw new Error(`No substantial source found for ${category}`);
