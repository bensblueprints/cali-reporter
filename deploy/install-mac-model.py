#!/usr/bin/env python3
"""Install isolated, loopback-only Ollama. Use sudo with --user for boot startup."""
import pathlib
import plistlib
import subprocess
import os
import pwd
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--user', default=pwd.getpwuid(os.getuid()).pw_name)
args = parser.parse_args()
account = pwd.getpwnam(args.user)
home = pathlib.Path(account.pw_dir)
system = os.geteuid() == 0
root = home / 'Library/Application Support/CaliReporter'
root.mkdir(parents=True, exist_ok=True)
(root / 'models').mkdir(exist_ok=True)
if system:
    os.chown(root, account.pw_uid, account.pw_gid)
    os.chown(root / 'models', account.pw_uid, account.pw_gid)
label = 'com.calireporter.ollama'
agent = home / 'Library/LaunchAgents' / (label + '.plist')
target = pathlib.Path('/Library/LaunchDaemons') / (label + '.plist') if system else agent
target.parent.mkdir(parents=True, exist_ok=True)
config = {
    'Label': label,
    'ProgramArguments': ['/usr/local/bin/ollama', 'serve'],
    'EnvironmentVariables': {
        'HOME': str(home),
        'OLLAMA_HOST': '127.0.0.1:11435',
        'OLLAMA_MODELS': str(root / 'models'),
        'OLLAMA_CONTEXT_LENGTH': '16384',
        'OLLAMA_NUM_PARALLEL': '1',
        'OLLAMA_MAX_LOADED_MODELS': '1',
        'OLLAMA_KEEP_ALIVE': '15m',
        'OLLAMA_NO_CLOUD': '1',
    },
    'RunAtLoad': True,
    'KeepAlive': True,
    'ThrottleInterval': 15,
    'StandardOutPath': str(root / 'ollama.stdout.log'),
    'StandardErrorPath': str(root / 'ollama.stderr.log'),
}
if system:
    config['UserName'] = account.pw_name
    subprocess.run(['launchctl', 'bootout', f'gui/{account.pw_uid}/{label}'], capture_output=True)
    if agent.exists():
        agent.rename(agent.with_suffix('.plist.disabled'))
if target.exists():
    target.with_suffix('.plist.previous').write_bytes(target.read_bytes())
target.write_bytes(plistlib.dumps(config))
target.chmod(0o644)
domain = 'system' if system else f'gui/{account.pw_uid}'
subprocess.run(['launchctl', 'bootout', domain + '/' + label], capture_output=True)
subprocess.run(['launchctl', 'bootstrap', domain, str(target)], check=True)
print(f'Installed {label}; model storage: {root / "models"}')
