// Standalone workers must release their host flock after all jobs and DB writes
// finish, even when a provider leaves a socket/timer referenced in Node's loop.
export async function exitWorker(code = 0) {
  await Promise.all([process.stdout, process.stderr].map(stream =>
    new Promise(resolve => stream.write('', resolve))));
  process.exit(code);
}
