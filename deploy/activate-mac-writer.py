#!/usr/bin/env python3
"""Activate the validated MLX writer while holding the existing writer flock.

flock -w 1200 /run/lock/migrated-cali-aggregate.lock python3 activate-mac-writer.py
"""
import pathlib
import re
import shutil
import subprocess
import time

root = pathlib.Path(__file__).resolve().parent
cron = pathlib.Path('/etc/cron.d/selected-migration')
feeds = pathlib.Path('/opt/selected-migration-20261016/cali/mount-0')
original = cron.read_text()
lines = original.splitlines()
matches = [i for i,line in enumerate(lines)
           if not line.startswith('#') and 'migrated-cali' in line
           and 'node /app/scripts/hourly-writers.js' in line]
if len(matches) != 1:
    raise SystemExit('Expected exactly one existing CaliReporter writer schedule.')
index = matches[0]
backups = [i for i,line in enumerate(lines) if not line.startswith('#')
           and 'docker exec migrated-cali' in line and 'cp /app/data/migrated-cali.db' in line]
if len(backups) != 1:
    raise SystemExit('Expected the known daily database backup schedule.')
lines[backups[0]] = '15 10 * * * root docker exec migrated-cali node /app/scripts/backup-database.mjs >> /var/log/migrated-cali-backup.log 2>&1'
for key,value in {
    'LOCALFLEET_ARTICLE_BASE_URL':'http://10.0.32.1:11438',
    'LOCALFLEET_MODEL_SECTION':'default_model',
    'LOCALFLEET_MODEL_REVIEW':'default_model',
}.items():
    lines[index],count = re.subn(r'(?<=-e )' + key + r'=\S+', key + '=' + value, lines[index])
    if count != 1:raise SystemExit('Missing or duplicate schedule setting: ' + key)
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
shutil.copy2(cron, root / ('cron-before-activation-' + stamp))
saved_feeds = root / ('feeds-before-activation-' + stamp + '.json')
shutil.copy2(feeds, saved_feeds)
backup_code = "import Database from 'better-sqlite3'; const db=new Database(process.env.DATABASE_PATH); await db.backup('/app/data/pre-mlx-" + stamp + ".db'); db.close();"
subprocess.run(['docker','exec','migrated-cali','node','--input-type=module','-e',backup_code], check=True)
shutil.copyfile(root / 'feeds.json', feeds)
try:
    subprocess.run(['python3', str(root / 'replace-cali-container.py'),
                    'selected-migration/cali:20261018-mac'], check=True)
except Exception:
    shutil.copyfile(saved_feeds, feeds)
    raise
temporary = cron.with_suffix('.calireporter-tmp')
temporary.write_text('\n'.join(lines) + '\n')
temporary.chmod(cron.stat().st_mode & 0o777)
temporary.replace(cron)
print('MLX schedule activated; original cron, feeds, container and online SQLite backup preserved.')
