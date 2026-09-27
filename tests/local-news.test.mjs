import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLocalItems,discardImportedText} from '../lib/local-news.js';
const now=Date.parse('2026-09-27T12:00:00Z');
const item=(title,hours=1)=>({title,isoDate:new Date(now-hours*3600000).toISOString()});
test('current matching coverage ranks ahead of unrelated headlines, with unique sources counted',()=>{
 const a=item('Fresno council approves downtown housing project',3),b=item('Fresno university opens science laboratory');
 const signals=[item(a.title+' - Local Paper'),item(a.title+' - Local Paper'),item('Downtown housing project approved by Fresno council - City Radio')];
 const ranked=rankLocalItems([b,a],signals,now);
 assert.equal(ranked[0].title,a.title);assert.equal(ranked[0].localCoverageMatches,2);
 assert.equal(ranked[1].localCoverageMatches,0);
});
test('stale, future, undated items are excluded; unavailable trends fall back to recency',()=>{
 const recent=item('San Diego transit service expands',1),older=item('San Diego library opens',5);
 const ranked=rankLocalItems([older,item('Old',73),item('Future',-4),{title:'Undated'},recent],[],now);
 assert.deepEqual(ranked.map(x=>x.title),[recent.title,older.title]);
 assert.equal(rankLocalItems([older],[item(older.title+' - Paper',73)],now)[0].localCoverageMatches,0);
});
test('temporary source body is discarded but attribution survives',()=>{
 const original={title:'Source title',link:'https://example.com/report',guid:'report-1',content:'Source body',contentSnippet:'Source summary',summary:'Other source text','content:encoded':'Body'};
 discardImportedText(original);
 assert.deepEqual(original,{title:'Source title',link:'https://example.com/report',guid:'report-1'});
});
