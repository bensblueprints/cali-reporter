// Loopback-only SSE relay. Caddy retains authentication in front of this route.
// Send heartbeats while Ollama queues a request, before its response headers arrive.
import http from 'node:http';
import {pathToFileURL} from 'node:url';

export function relayOptions(env=process.env){
 const upstream=env.CALI_RELAY_UPSTREAM||'http://127.0.0.1:11434';
 const url=new URL(upstream);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)
  throw new Error('CALI_RELAY_UPSTREAM must be a loopback HTTP endpoint');
 const timeoutMs=Number(env.CALI_RELAY_TIMEOUT_MS||240000);
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>600000)
  throw new Error('CALI_RELAY_TIMEOUT_MS must be 1000–600000');
 return {upstream,timeoutMs};
}

export function createRelay({upstream='http://127.0.0.1:11434',heartbeatMs=10000,timeoutMs=240000}={}) {
 return http.createServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/health'){
   res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;
  }
  if(req.method!=='POST'||req.url!=='/v1/chat/completions'){
   res.writeHead(404);res.end();return;
  }
  const chunks=[];let size=0;
  req.on('data',chunk=>{
   size+=chunk.length;
   if(size>1024*1024){res.writeHead(413);res.end();req.destroy();return;}
   chunks.push(chunk);
  });
  req.on('end',()=>{
   if(res.writableEnded)return;
   const body=Buffer.concat(chunks);let input;
   try{input=JSON.parse(body);}catch{res.writeHead(400);res.end();return;}
   if(input.stream!==true){res.writeHead(400);res.end('Streaming required');return;}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
   res.flushHeaders();res.write(': waiting for inference\n\n');
   let upstreamResponse,finished=false;
   const finish=()=>{
    if(finished)return;finished=true;clearInterval(heartbeat);clearTimeout(deadline);
    upstreamResponse?.destroy();outgoing.destroy();
   };
   const fail=message=>{
    if(finished||res.writableEnded)return;
    res.end(`data: ${JSON.stringify({error:{message}})}\n\ndata: [DONE]\n\n`);finish();
   };
   const outgoing=http.request(new URL('/v1/chat/completions',upstream),{
    method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length},
   },response=>{
    upstreamResponse=response;
    if(response.statusCode!==200){fail(`Article model HTTP ${response.statusCode}`);return;}
    response.on('data',chunk=>{
     if(!res.write(chunk)){response.pause();res.once('drain',()=>response.resume());}
    });
    response.on('end',()=>{res.end();finish();});
    response.on('error',()=>fail('Inference upstream connection failed'));
    response.on('aborted',()=>fail('Inference upstream disconnected'));
   });
   const heartbeat=setInterval(()=>{if(!finished&&!res.writableEnded)res.write(': keepalive\n\n');},heartbeatMs);
   const deadline=setTimeout(()=>fail('Inference upstream timed out'),timeoutMs);
   outgoing.on('error',()=>fail('Inference upstream connection failed'));
   res.on('close',finish);
   outgoing.end(body);
  });
  req.on('error',()=>{if(!res.writableEnded)res.end();});
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=createRelay(relayOptions());
 server.listen(Number(process.env.CALI_RELAY_PORT||11436),'127.0.0.1');
 const stop=()=>server.close(()=>process.exit(0));
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
