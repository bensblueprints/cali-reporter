import test from 'node:test';
import assert from 'node:assert/strict';
import {rewriteLocalfleet} from '../lib/ai/localfleet.js';
const input={kind:'section-brief',title:'Water main break on Saturday',body:'A 6-inch water main broke at 1:05 a.m. on Saturday near Varna Drive in Sherman Oaks. Water surrounded parked vehicles and affected nearly two dozen customers.',sourceName:'News source',sourceUrl:'https://source.example/story',category:'los-angeles'};
function completion(obj) {return new Response('data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(obj)}}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});}
test('publication stops when factual review rejects unsupported draft details',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>completion(++calls===1?{title:'Water main breaks',deck:'Crews expect repairs by noon',html:'<p>A water main broke on Saturday and repairs will finish by noon.</p>'}:{supported:false,issues:['Repair forecast is unsupported']});
 try {await assert.rejects(rewriteLocalfleet(input),/failed source-based factual review/);assert.equal(calls,2);}finally {global.fetch=original;}
});
test('supported short source produces a sourced disclosed brief without padding',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>completion(++calls===1?{title:'Water main breaks in Sherman Oaks',deck:'Water surrounded parked vehicles Saturday.',html:'<p>A 6-inch water main broke near Varna Drive in Sherman Oaks around 1:05 a.m. Saturday, surrounding parked vehicles and affecting nearly two dozen customers.</p>'}:{supported:true,issues:[]});
 try {const result=await rewriteLocalfleet(input);assert.equal(calls,2);assert.match(result.html,/Prepared with AI assistance/);assert.ok(result.html.includes(input.sourceUrl));}finally {global.fetch=original;}
});

test('direct quotation drafts are rejected before publication even before model review',async()=>{
 const original=global.fetch;
 global.fetch=async()=>completion({title:'Stadium review',deck:'A candidate discusses stadium revenue.',html:'<p>Watanabe said “it’s not enough.”</p>'});
 try {await assert.rejects(rewriteLocalfleet(input),/without direct quotations/);}finally {global.fetch=original;}
});
