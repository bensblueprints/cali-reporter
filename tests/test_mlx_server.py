import importlib.util
import json
import os
from pathlib import Path
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

path = Path(os.environ.get('CALI_MLX_SERVER',str(Path(__file__).parents[1]/'deploy/mlx-writer-server.py')))
spec = importlib.util.spec_from_file_location('writer_server',path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def request_body():
    return {'model':'default_model','stream':True,'messages':[{'role':'user','content':'Test'}],
            'max_tokens':100,'response_format':{'type':'json_schema','json_schema':{
                'schema':{'type':'object','required':['ok'],'properties':{'ok':{'type':'boolean'}},'additionalProperties':False}}}}

class FakeEngine:
    def __init__(self,pieces,gate=None):self.pieces,self.gate=pieces,gate
    def stream(self,*args):
        if self.gate:self.gate.wait(5)
        yield from self.pieces

class EndpointTests(unittest.TestCase):
    def start(self,engine):
        self.executor=ThreadPoolExecutor(max_workers=1)
        self.server=module.WriterServer(('127.0.0.1',0),self.executor,engine)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.url='http://127.0.0.1:'+str(self.server.server_address[1])
    def tearDown(self):
        if hasattr(self,'server'):
            self.server.shutdown();self.server.server_close();self.executor.shutdown(wait=True)
    def post(self,body):
        return urllib.request.urlopen(urllib.request.Request(self.url+'/v1/chat/completions',
             data=json.dumps(body).encode(),headers={'Content-Type':'application/json'}),timeout=10)
    def test_valid_output_uses_compatible_sse_and_finishes(self):
        self.start(FakeEngine(['{"ok":','true}']))
        with self.post(request_body()) as response:output=response.read().decode()
        self.assertIn('data: [DONE]',output)
        self.assertIn('"finish_reason": "stop"',output)
        self.assertNotIn('"error"',output)
    def test_truncated_output_is_an_error_not_success(self):
        self.start(FakeEngine(['{"ok":']))
        with self.post(request_body()) as response:output=response.read().decode()
        self.assertIn('Inference upstream generation failed',output)
        self.assertNotIn('"finish_reason": "stop"',output)
    def test_schema_violation_is_rejected(self):
        self.start(FakeEngine(['{"ok":"not a boolean"}']))
        with self.post(request_body()) as response:output=response.read().decode()
        self.assertIn('Inference upstream generation failed',output)
    def test_busy_worker_returns_retryable_status(self):
        gate=threading.Event();self.start(FakeEngine(['{"ok":true}'],gate))
        first=self.post(request_body())
        try:
            with self.assertRaises(urllib.error.HTTPError) as caught:self.post(request_body())
            self.assertEqual(caught.exception.code,429)
        finally:
            gate.set();first.read();first.close()
    def test_dynamic_model_and_unbounded_tokens_are_rejected(self):
        self.start(FakeEngine([]))
        for key,value in [('model','other-model'),('max_tokens',50000),('stream',False)]:
            body=request_body();body[key]=value
            with self.assertRaises(urllib.error.HTTPError) as caught:self.post(body)
            self.assertEqual(caught.exception.code,400)
    def test_health_reports_only_dedicated_runtime(self):
        self.start(FakeEngine([]))
        with urllib.request.urlopen(self.url+'/health') as response:data=json.load(response)
        self.assertEqual(data,{'ready':True,'runtime':'mlx-outlines','busy':False})

if __name__=='__main__':unittest.main()
