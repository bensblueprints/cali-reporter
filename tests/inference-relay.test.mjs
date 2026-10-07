import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createRelay,relayOptions} from '../deploy/inference-heartbeat-proxy.mjs';
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
const body=JSON.stringify({stream:true,messages:[]});
test('relay configuration permits a dedicated loopback worker with a bounded deadline',()=>{
 assert.deepEqual(relayOptions({}),{upstream:'http://127.0.0.1:11434',timeoutMs:240000});
 assert.deepEqual(relayOptions({CALI_RELAY_UPSTREAM:'http://127.0.0.1:11437',CALI_RELAY_TIMEOUT_MS:'360000'}),{upstream:'http://127.0.0.1:11437',timeoutMs:360000});
 for(const upstream of ['https://example.com','http://10.0.0.1:11434','http://secret@localhost'])
  assert.throws(()=>relayOptions({CALI_RELAY_UPSTREAM:upstream}),/loopback/);
 for(const timeoutMs of ['0','NaN','700000','1.5'])
  assert.throws(()=>relayOptions({CALI_RELAY_TIMEOUT_MS:timeoutMs}),/1000/);
});
test('relay sends headers and heartbeats before a queued upstream starts, then forwards SSE',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const upstream=http.createServer(async(req,res)=>{await gate;res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');});
 const relay=createRelay({upstream:await listen(upstream),heartbeatMs:10,timeoutMs:2000});
 try{
  const response=await fetch(await listen(relay)+'/v1/chat/completions',{method:'POST',body,signal:AbortSignal.timeout(1000)});
  const reader=response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value),/waiting for inference/);
  assert.match(new TextDecoder().decode((await reader.read()).value),/keepalive/);
  release();let rest='';for(;;){const {value,done}=await reader.read();if(done)break;rest+=new TextDecoder().decode(value);}
  assert.match(rest,/"content":"ok"/);assert.match(rest,/\[DONE\]/);
 }finally{release();await close(relay);await close(upstream);}
});
test('upstream errors are explicit SSE errors and unsupported routes cannot become an open proxy',async()=>{
 const upstream=http.createServer((req,res)=>{res.writeHead(503);res.end('private diagnostics');});
 const relay=createRelay({upstream:await listen(upstream)});
 try{
  const base=await listen(relay);
  const response=await fetch(base+'/v1/chat/completions',{method:'POST',body});
  const text=await response.text();assert.match(text,/HTTP 503/);assert(!text.includes('private diagnostics'));
  assert.equal((await fetch(base+'/arbitrary')).status,404);
 }finally{await close(relay);await close(upstream);}
});
test('client cancellation closes an active upstream request',async()=>{
 let disconnected;
 const closed=new Promise(resolve=>{disconnected=resolve;});
 const upstream=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(': ready\n\n');res.on('close',disconnected);});
 const relay=createRelay({upstream:await listen(upstream),heartbeatMs:10});
 try{
  const controller=new AbortController();
  const response=await fetch(await listen(relay)+'/v1/chat/completions',{method:'POST',body,signal:controller.signal});
  const reader=response.body.getReader();let text='';
  while(!text.includes(': ready'))text+=new TextDecoder().decode((await reader.read()).value);
  controller.abort();
  await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('upstream not cancelled')),1000);timer.unref();})]);
 }finally{await close(relay);await close(upstream);}
});
