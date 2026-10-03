import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArticle,validateQuotes,copiedWordCount,writeReportedArticle,plainText,wordCount} from '../lib/ai/reported-article.js';
const url='https://example.com/story';
const draft=n=>({title:'A sourced title',deck:'A factual deck',html:`<h2>Details</h2><p>${'evidence '.repeat(n-1)}</p>`});
test('copied passages are detected even after quotation marks and punctuation are removed',()=>{
 const source=Array.from({length:40},(_,i)=>`word${i}`).join(' ');
 assert.equal(copiedWordCount(`<p>${source.toUpperCase()}.</p>`,source),40);
 assert.equal(copiedWordCount('<p>Completely different wording describing the same broad topic.</p>',source),0);
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
