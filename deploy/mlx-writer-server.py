#!/usr/bin/env python3
"""Private, single-model MLX endpoint with schema-constrained SSE generation."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import queue
import threading
import time

MAX_BODY = 131072
MAX_PROMPT = 12000
DEADLINE = 340

def validate_request(body):
    if not isinstance(body, dict) or body.get('model') != 'default_model':
        raise ValueError('Only default_model is available')
    if body.get('stream') is not True:
        raise ValueError('Streaming is required')
    messages = body.get('messages')
    if not isinstance(messages, list) or not 1 <= len(messages) <= 20:
        raise ValueError('Expected 1 to 20 messages')
    for message in messages:
        if not isinstance(message, dict) or message.get('role') not in ('system','user','assistant') or not isinstance(message.get('content'),str):
            raise ValueError('Invalid text message')
    tokens = body.get('max_tokens', 4000)
    if type(tokens) is not int or not 1 <= tokens <= 4000:
        raise ValueError('max_tokens must be 1 to 4000')
    temperature = body.get('temperature', 0.6)
    if type(temperature) not in (int,float) or not 0 <= temperature <= 1.5:
        raise ValueError('Invalid temperature')
    response_format = body.get('response_format',{})
    if response_format.get('type') != 'json_schema':
        raise ValueError('A JSON schema is required')
    schema = response_format.get('json_schema',{}).get('schema')
    if not isinstance(schema,dict) or schema.get('type') != 'object' or len(json.dumps(schema)) > 16384:
        raise ValueError('Invalid or oversized object schema')
    return messages,tokens,temperature,schema

class Engine:
    def __init__(self, model_path):
        import mlx.core as mx
        import mlx_lm
        import outlines
        self.mx = mx
        mx.set_memory_limit(10 * 1024**3)
        mx.set_cache_limit(512 * 1024**2)
        raw_model,self.tokenizer = mlx_lm.load(str(model_path))
        self.model = outlines.from_mlxlm(raw_model,self.tokenizer)
        self.ready = True

    def stream(self, messages, tokens, temperature, schema):
        from outlines.types import JsonSchema
        from mlx_lm.sample_utils import make_sampler
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False,
                    add_generation_prompt=True, enable_thinking=False)
        if len(self.tokenizer.encode(prompt)) > MAX_PROMPT:
            raise ValueError('Prompt exceeds 12000 tokens')
        yield from self.model.stream(prompt, output_type=JsonSchema(schema),
                    max_tokens=tokens, sampler=make_sampler(temp=temperature,top_p=0.95),
                    prefill_step_size=512)

class WriterServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, executor, engine):
        super().__init__(address, Handler)
        self.executor,self.engine = executor,engine
        self.busy = threading.Lock()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logging.info(fmt, *args)

    def reply(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/health':
            self.reply(200,{'ready':True,'runtime':'mlx-outlines','busy':self.server.busy.locked()})
        elif self.path == '/v1/models':
            self.reply(200,{'object':'list','data':[{'id':'default_model','object':'model'}]})
        else:self.reply(404,{'error':'Not found'})

    def do_POST(self):
        if self.path != '/v1/chat/completions':
            self.reply(404,{'error':'Not found'});return
        self.connection.settimeout(20)
        try:
            length = int(self.headers.get('Content-Length','0'))
            if not 0 < length <= MAX_BODY:raise ValueError('Invalid request size')
            body = json.loads(self.rfile.read(length))
            parameters = validate_request(body)
            import jsonschema
            jsonschema.Draft202012Validator.check_schema(parameters[3])
        except Exception as error:
            self.reply(400,{'error':str(error)[:200]});return
        if not self.server.busy.acquire(blocking=False):
            self.reply(429,{'error':'Writer is busy; retry later'});return
        events = queue.Queue(maxsize=64)
        cancelled = threading.Event()
        finished = threading.Event()
        started = time.monotonic()

        def emit(event):
            while not cancelled.is_set():
                try:events.put(event,timeout=0.5);return
                except queue.Full:pass

        def generate():
            pieces = []
            try:
                stream = self.server.engine.stream(*parameters)
                try:
                    for piece in stream:
                        if cancelled.is_set():return
                        if time.monotonic()-started > DEADLINE:
                            raise TimeoutError('generation deadline exceeded')
                        pieces.append(piece)
                        emit({'choices':[{'delta':{'content':piece}}]})
                finally:
                    close = getattr(stream,'close',None)
                    if close:close()
                # Exhausting the token allowance must never look like success.
                value = json.loads(''.join(pieces))
                jsonschema.validate(value,parameters[3])
                emit({'choices':[{'delta':{},'finish_reason':'stop'}]})
                emit('[DONE]')
                logging.info('Completed request in %.1fs',time.monotonic()-started)
            except Exception as error:
                logging.warning('Generation failed: %s',type(error).__name__)
                emit({'error':{'message':'Inference upstream generation failed: '+str(error)[:180]}})
                emit('[DONE]')
            finally:
                finished.set()
                self.server.busy.release()

        def watchdog():
            if not finished.wait(DEADLINE+30):
                logging.error('Native inference stalled; restarting service')
                os._exit(70)  # launchd restarts the dedicated, single-request worker.

        self.server.executor.submit(generate)
        threading.Thread(target=watchdog,daemon=True).start()
        try:
            self.send_response(200)
            self.send_header('Content-Type','text/event-stream')
            self.send_header('Cache-Control','no-cache')
            self.send_header('Connection','close')
            self.end_headers()
            while True:
                try:event = events.get(timeout=5)
                except queue.Empty:
                    self.wfile.write(b': keepalive\n\n');self.wfile.flush();continue
                line = event if isinstance(event,str) else json.dumps(event)
                self.wfile.write(('data: '+line+'\n\n').encode())
                self.wfile.flush()
                if event == '[DONE]':break
        except (BrokenPipeError,ConnectionError,TimeoutError,OSError):
            logging.info('Client disconnected; cancelling generation')
        finally:
            cancelled.set()
            self.close_connection = True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model',type=Path,required=True)
    parser.add_argument('--port',type=int,default=11435)
    parser.add_argument('--logs',type=Path,required=True)
    args = parser.parse_args()
    args.logs.mkdir(parents=True,exist_ok=True)
    handler = RotatingFileHandler(args.logs/'writer.log',maxBytes=10*1024**2,backupCount=5)
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    logging.basicConfig(level=logging.INFO,handlers=[handler])
    executor = ThreadPoolExecutor(max_workers=1,thread_name_prefix='mlx-writer')
    engine = executor.submit(Engine,args.model).result()
    server = WriterServer(('127.0.0.1',args.port),executor,engine)
    logging.info('MLX structured writer ready on loopback port %d',args.port)
    server.serve_forever()

if __name__ == '__main__':main()
