import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const suffix = randomUUID().replaceAll('-', '');
const name = `foundation-pg-test-${suffix}`;
const database = `foundation_pg_test_${suffix}`;
const image = 'postgres:16-alpine';
let attempted = false;

function docker(args) {
  return execFileSync('docker', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim();
}

try {
  // Trust authentication is limited to this disposable loopback-only fixture.
  // No volume or user-supplied database URL is used.
  attempted = true;
  docker(['run', '--detach', '--pull=never', '--name', name, '--label', `foundation.test-run=${suffix}`,
    '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data:rw',
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', `POSTGRES_DB=${database}`, image,
    'postgres', '-c', 'statement_timeout=5000', '-c', 'lock_timeout=3000']);
  const deadline = Date.now() + 30000;
  while (true) {
    try { docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', database]); break; }
    catch (error) { if (Date.now() >= deadline) throw error; }
    await setTimeout(250);
  }
  const binding = docker(['port', name, '5432/tcp']);
  const port = /^127\.0\.0\.1:(\d+)$/.exec(binding)?.[1];
  if (!port) throw new Error('Expected one loopback PostgreSQL port binding');
  console.log(`Running independent-connection tests against disposable ${image}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
    'run', 'src/infrastructure/postgres.integration.test.ts', '--testTimeout=10000', '--hookTimeout=15000'], {
    cwd, stdio: 'inherit', env: { ...process.env,
      FOUNDATION_POSTGRES_TEST_URL: `postgresql://postgres@127.0.0.1:${port}/${database}` },
    timeout: 120000,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PostgreSQL integration verification failed');
  process.exitCode = 1;
} finally {
  if (attempted) {
    try {
      // Also recover a container created before a failed start or CLI timeout.
      const id = docker(['ps', '--all', '--filter', `name=^/${name}$`,
        '--filter', `label=foundation.test-run=${suffix}`, '--format', '{{.ID}}']);
      if (id) docker(['rm', '--force', id]);
    } catch { console.error(`Could not verify cleanup of disposable fixture ${name}`); process.exitCode = 1; }
  }
}
