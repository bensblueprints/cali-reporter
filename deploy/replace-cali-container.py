#!/usr/bin/env python3
"""Replace only migrated-cali, preserving its runtime configuration and rollback.

Run under /run/lock/migrated-cali-aggregate.lock after building and testing image.
Usage: python3 replace-cali-container.py IMAGE
"""
import copy
import http.client
import json
import pathlib
import socket
import sys
import time
import urllib.request

class Docker(http.client.HTTPConnection):
    def __init__(self):
        super().__init__('localhost', timeout=90)
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect('/var/run/docker.sock')

def api(method, path, body=None):
    client = Docker()
    client.request(method, '/v1.47' + path,
                   json.dumps(body).encode() if body is not None else None,
                   {'Content-Type': 'application/json'})
    response = client.getresponse()
    data = response.read()
    client.close()
    if response.status not in (200, 201, 204, 304):
        raise RuntimeError(f'Docker operation {method} {path} failed: HTTP {response.status}')
    return json.loads(data) if data else {}

name = 'migrated-cali'
image = sys.argv[1]
old = api('GET', '/containers/' + name + '/json')
api('GET', '/images/' + image + '/json')
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
backup_name = name + '-before-' + stamp
backup = pathlib.Path('/opt/cali-recovery-20261018') / ('container-' + stamp + '.json')
backup.write_text(json.dumps(old))
backup.chmod(0o600)
config = {key:copy.deepcopy(old['Config'][key]) for key in
          ('Env','Cmd','Entrypoint','WorkingDir','User','Healthcheck','ExposedPorts','StopSignal','Labels')
          if old['Config'].get(key) is not None}
config['Image'] = image
config['HostConfig'] = {key:copy.deepcopy(old['HostConfig'][key]) for key in
                       ('Binds','RestartPolicy','PortBindings','ShmSize','NetworkMode','LogConfig','Init','SecurityOpt','CapDrop','CapAdd','Memory','NanoCpus')
                       if old['HostConfig'].get(key) is not None}
networks = old['NetworkSettings']['Networks']
config['NetworkingConfig'] = {'EndpointsConfig':{
    network:{'Aliases':details.get('Aliases') or [],
             'IPAMConfig':{'IPv4Address':details['IPAddress']}}
    for network,details in networks.items()}}
created = False
renamed = False
disconnected = []
try:
    api('POST', '/containers/' + name + '/stop?t=30')
    for network in networks:
        api('POST', '/networks/' + network + '/disconnect', {'Container':old['Id']})
        disconnected.append(network)
    api('POST', '/containers/' + name + '/rename?name=' + backup_name)
    renamed = True
    api('POST', '/containers/create?name=' + name, config)
    created = True
    api('POST', '/containers/' + name + '/start')
    healthy = False
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18302/', timeout=5) as response:
                healthy = response.status == 200
            if healthy:break
        except Exception:pass
        time.sleep(2)
    if not healthy:raise RuntimeError('Replacement homepage health check failed')
    api('POST', '/containers/' + backup_name + '/update', {'RestartPolicy':{'Name':'no'}})
    print(json.dumps({'image':image,'healthy':True,'rollbackContainer':backup_name}))
except Exception:
    if created:api('DELETE', '/containers/' + name + '?force=true')
    if renamed:api('POST', '/containers/' + backup_name + '/rename?name=' + name)
    for network in disconnected:
        api('POST', '/networks/' + network + '/connect', {
            'Container':old['Id'],
            'EndpointConfig':{'Aliases':networks[network].get('Aliases') or [],
                              'IPAMConfig':{'IPv4Address':networks[network]['IPAddress']}}})
    api('POST', '/containers/' + name + '/start')
    raise
