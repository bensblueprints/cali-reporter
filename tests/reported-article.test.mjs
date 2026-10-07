import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArticle,validateQuotes,copiedWordCount,sourceOverlap,writeReportedArticle,plainText,wordCount,completion} from '../lib/ai/reported-article.js';
const url='https://example.com/story';
const draft=n=>({title:'A sourced title',deck:'A factual deck',html:`<h2>Details</h2><p>${'evidence '.repeat(n-1)}</p>`});
test('stream reader ignores heartbeats but surfaces relay errors instead of fabricating a draft',async()=>{
 const ok=': keepalive\n\ndata: '+JSON.stringify({choices:[{delta:{content:'{"ok":true}'}}]})+'\n\ndata: [DONE]\n\n';
 assert.deepEqual(await completion([],20,async()=>new Response(ok)),{ok:true});
 const fail=': waiting\n\ndata: {"error":{"message":"Article model HTTP 503"}}\n\n';
 await assert.rejects(completion([],20,async()=>new Response(fail)),/HTTP 503/);
});
test('copied passages are detected even after quotation marks and punctuation are removed',()=>{
 const source=Array.from({length:40},(_,i)=>`word${i}`).join(' ');
 assert.equal(copiedWordCount(`<p>${source.toUpperCase()}.</p>`,source),40);
 assert.equal(copiedWordCount('<p>Completely different wording describing the same broad topic.</p>',source),0);
});
test('overlap feedback groups matching windows without double-counting words',()=>{
 const first='one two three four five six seven eight nine ten';
 const second='alpha beta gamma delta epsilon zeta eta theta';
 assert.deepEqual(sourceOverlap(`<p>${first.toUpperCase()}. Fresh transition. ${second}.</p>`,first+' '+second),{
  words:18,passages:[first,second],
 });
});
test('copy repair identifies offending passages while retaining the original threshold',async()=>{
 const passage=Array.from({length:30},(_,i)=>`sourceword${i}`).join(' ');
 const copied={...draft(700),html:draft(700).html+`<p>${passage}</p>`};
 let calls=0;
 const result=await writeReportedArticle({body:'fact '.repeat(900)+passage,sourceUrl:url},async(messages)=>{
  calls++;
  if(calls===1)return copied;
  if(calls===2){assert.match(messages.at(-1).content,/Rewrite these matching passages/);assert(messages.at(-1).content.includes(passage));return draft(700);}
  return {supported:true,issues:[]};
 });
 assert.equal(calls,3);assert(result.words>=600);
});
test('brief quotes must match source exactly and stay within the quotation limit',()=>{
 validateQuotes('<p>The program is called “Safer Streets”.</p>','The Safer Streets program opens today.');
 assert.throws(()=>validateQuotes('<p>She said “Invented interview”.</p>','No interview.'),/verbatim/);
 assert.throws(()=>validateQuotes(`<p>“${'quote '.repeat(26)}”</p>`,'quote '.repeat(26)),/maximum/);
});
test('enforces user word boundaries and safe structured HTML',()=>{
 assert.throws(()=>validateArticle(draft(599),url),/length/);
 assert.equal(validateArticle(draft(600),url).words,600);
 assert.equal(validateArticle(draft(2500),url).words,2500);
 assert.throws(()=>validateArticle(draft(2501),url),/length/);
 const cleaned=validateArticle({...draft(650),html:draft(650).html+`<script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">link</a><h3 class="bad">Facts</h3>`},url);
 assert(!/script|onclick|class=/.test(cleaned.html));assert.match(cleaned.html,/<h3>Facts<\/h3>/);
});
test('thin source never calls model and failed review never publishes fallback',async()=>{
 await assert.rejects(writeReportedArticle({body:'short'},()=>{throw new Error('should not call');}),/Insufficient/);
 let calls=0;
 await assert.rejects(writeReportedArticle({body:'fact '.repeat(900),sourceUrl:url},async()=>++calls%2?draft(700):{supported:false,issues:['Unsupported claim']}),/review/);
 assert.equal(calls,4);
});
test('provider outage defers to durable backoff without three immediate generation retries',async()=>{
 let calls=0;
 await assert.rejects(writeReportedArticle({body:'fact '.repeat(900),sourceUrl:url},async()=>{calls++;throw new Error('Article model HTTP 524');}),/HTTP 524/);
 assert.equal(calls,1);
});
test('revision repairs short draft and final result includes safely escaped credit',async()=>{
 let calls=0;
 const output=await writeReportedArticle({body:'fact '.repeat(1000),sourceUrl:url,sourceName:'Research <Institute>'},async()=>{
  calls++;return calls===1?draft(80):calls===2?draft(750):{supported:true,issues:[]};
 });
 assert.equal(calls,3);assert.match(output.html,/Research &lt;Institute&gt;/);
 assert(wordCount(plainText(output.html))>=600);
});
test('length repair still permits a later factual correction',async()=>{
 let calls=0;
 const responses=[draft(80),draft(750),{supported:false,issues:['Wrong date']},draft(750),{supported:true,issues:[]}];
 const out=await writeReportedArticle({body:'fact '.repeat(1000),sourceUrl:url,sourceName:'Source'},async()=>responses[calls++]);
 assert.equal(calls,5);assert(out.words>=600);
});

function fallbackEnvironment(t) {
 const vars={LOCALFLEET_ARTICLE_BASE_URL:'https://primary.example',LOCALFLEET_API_KEY:'primary-test-key',
  LOCALFLEET_ARTICLE_FALLBACK_BASE_URL:'http://mac.example:11435',LOCALFLEET_ARTICLE_FALLBACK_MODEL:'tested-mac-model',
  LOCALFLEET_ARTICLE_FALLBACK_API_KEY:'',LOCALFLEET_ARTICLE_FALLBACK_REVIEW_MODEL:'tested-mac-review'};
 const before=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));
 Object.assign(process.env,vars);
 t.after(()=>{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
}
const streamed=value=>new Response('data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(value)}}]})+'\n\ndata: [DONE]\n\n');
test('healthy primary does not call Mac fallback',async t=>{
 fallbackEnvironment(t);let calls=0;
 const result=await completion([],10000,async url=>{calls++;assert.match(url,/primary\.example/);return streamed({ok:true});});
 assert.deepEqual(result,{ok:true});assert.equal(calls,1);
});
test('primary outage falls back without leaking its key and returns to primary after recovery',async t=>{
 fallbackEnvironment(t);const calls=[];let primaryHealthy=false;
 const request=async(url,init)=>{
  calls.push(url);
  if(url.includes('primary.example')){assert.equal(init.headers.Authorization,'Bearer primary-test-key');return primaryHealthy?streamed({primary:true}):new Response('',{status:503});}
  assert.equal(init.headers.Authorization,undefined);
  assert.equal(JSON.parse(init.body).model,'tested-mac-model');return streamed({fallback:true});
 };
 assert.deepEqual(await completion([],10000,request),{fallback:true});
 primaryHealthy=true;assert.deepEqual(await completion([],10000,request),{primary:true});
 assert.equal(calls.length,3);
});
test('failover discards partial primary output and uses the fallback review model',async t=>{
 fallbackEnvironment(t);let calls=0;
 const result=await completion([],2500,async(url,init)=>{
  if(++calls===1)return new Response('data: {"choices":[{"delta":{"content":"{\\"unfinished\\":"}}]}\n\ndata: {"error":{"message":"Inference upstream disconnected"}}\n\n');
  assert.equal(JSON.parse(init.body).model,'tested-mac-review');return streamed({supported:true,issues:[]});
 });
 assert.deepEqual(result,{supported:true,issues:[]});assert.equal(calls,2);
});
test('authentication and malformed content errors do not trigger failover',async t=>{
 fallbackEnvironment(t);
 for(const response of [new Response('',{status:401}),new Response('data: {"choices":[{"delta":{"content":"invalid JSON"}}]}\n\n')]){
  let calls=0;await assert.rejects(completion([],10000,async()=>{calls++;return response;}));assert.equal(calls,1);
 }
});
test('both unavailable providers leave the article to durable retry without multiplying calls',async t=>{
 fallbackEnvironment(t);let calls=0;
 await assert.rejects(writeReportedArticle({body:'fact '.repeat(900),sourceUrl:url},
  (messages,tokens)=>completion(messages,tokens,async()=>{calls++;return new Response('',{status:429});})),/Inference upstreams failed/);
 assert.equal(calls,2);
});

test('generation and review share the source publication date and current context',async()=>{
 let calls=0,asOf;
 const output=await writeReportedArticle({body:'fact '.repeat(900),sourceUrl:url,sourcePublishedAt:'2026-10-07T08:00:00-07:00'},async(messages,tokens)=>{
  const data=JSON.parse(messages[1].content);
  assert.equal(data.sourcePublishedAt,'2026-10-07T15:00:00.000Z');
  assert(Number.isFinite(Date.parse(data.asOf)));
  if(++calls===1)asOf=data.asOf;else{assert.equal(data.asOf,asOf);assert.match(data.dateGuidance,/photo caption/);}
  return tokens===2500?{supported:true,issues:[]}:draft(700);
 });
 assert.equal(calls,2);assert(output.words>=600);
});
test('unknown or invalid source dates are not invented from the current clock',async()=>{
 for(const sourcePublishedAt of [undefined,'not a date'])await writeReportedArticle({body:'fact '.repeat(900),sourceUrl:url,sourcePublishedAt},async(messages,tokens)=>{
  assert.equal(JSON.parse(messages[1].content).sourcePublishedAt,null);
  return tokens===2500?{supported:true,issues:[]}:draft(700);
 });
});
