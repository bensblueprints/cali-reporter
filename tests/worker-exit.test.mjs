import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('completed worker flushes logs and exits despite a lingering provider handle', () => {
  const moduleUrl = new URL('../lib/worker-exit.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {exitWorker} from ${JSON.stringify(moduleUrl)};
    setInterval(() => {}, 1000);
    process.stdout.write('x'.repeat(200000));
    process.stderr.write('run-complete\\n');
    await exitWorker();
  `], {encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.length, 200000);
  assert.equal(result.stderr, 'run-complete\n');
});
