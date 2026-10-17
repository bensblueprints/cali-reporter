#!/usr/bin/env python3
"""Install the private MLX writer as a macOS boot-starting LaunchDaemon.

Run: sudo python3 install-mac-mlx.py --user benji
Requires ~/cali-writer/.venv with pinned mlx-lm and ~/cali-writer/model snapshot.
"""
import argparse
import os
import pathlib
import plistlib
import pwd
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--user', required=True)
parser.add_argument('--model', type=pathlib.Path, help='Installed model snapshot; defaults to ~/cali-writer/model')
args = parser.parse_args()
if os.geteuid() != 0:
    raise SystemExit('Install using sudo; model inference itself runs as the selected user.')
account = pwd.getpwnam(args.user)
home = pathlib.Path(account.pw_dir)
root = home / 'cali-writer'
server = root / 'mlx-writer-server.py'
model = (args.model or root / 'model').resolve()
if not server.is_file() or not (model / 'config.json').is_file():
    raise SystemExit('Install the Python environment and model snapshot first.')
label = 'com.calireporter.mlx'
target = pathlib.Path('/Library/LaunchDaemons') / (label + '.plist')
logs = root / 'logs'
logs.mkdir(exist_ok=True)
os.chown(logs, account.pw_uid, account.pw_gid)
config = {
    'Label': label,
    'UserName': account.pw_name,
    'WorkingDirectory': str(root),
    'ProgramArguments': [str(root / '.venv/bin/python'),str(server),
        '--model', str(model), '--port', '11435', '--logs',str(logs)],
    'EnvironmentVariables': {'HOME':str(home), 'PYTHONUNBUFFERED':'1',
        'HF_HUB_OFFLINE':'1', 'TOKENIZERS_PARALLELISM':'false'},
    'RunAtLoad': True,
    'KeepAlive': True,
    'ThrottleInterval': 20,
    'StandardOutPath': str(logs / 'mlx.stdout.log'),
    'StandardErrorPath': str(logs / 'mlx.stderr.log'),
}
if target.exists():target.with_suffix('.plist.previous').write_bytes(target.read_bytes())
target.write_bytes(plistlib.dumps(config))
target.chmod(0o644)
subprocess.run(['launchctl', 'bootout', 'system/' + label], capture_output=True)
for _ in range(40):
    if subprocess.run(['launchctl','print','system/'+label],capture_output=True).returncode:
        break
    time.sleep(0.25)
subprocess.run(['launchctl', 'bootstrap', 'system', str(target)], check=True)
print('Installed com.calireporter.mlx on loopback port 11435, running as ' + account.pw_name)
