import { PostgresDatabase } from '../dist/infrastructure/postgres.js';

const target = new URL(process.env.FOUNDATION_POSTGRES_TEST_URL ?? 'invalid:');
if (!process.send || process.argv[2] !== 'idle' || target.protocol !== 'postgresql:'
  || target.hostname !== '127.0.0.1' || target.search || target.hash || target.username !== 'postgres'
  || !/^\/foundation_pg_test_[a-f0-9]{32}$/.test(target.pathname)) {
  throw new Error('Connection worker requires IPC and a disposable PostgreSQL fixture');
}
const send = (message) => new Promise((resolve, reject) => {
  process.send(message, (error) => error ? reject(error) : resolve());
});
// Observe only the adapter's explicit log calls; an unhandled pool error still kills this process.
console.error = (...args) => { void send({ phase: 'idle-error', args }).catch(() => {}); };
const database = new PostgresDatabase(target.toString());
try {
  const probe = async () => (await database.query(`SELECT pg_backend_pid() AS pid,
    (SELECT count(*)::integer FROM identity.users) AS users`)).rows[0];
  // Register the command listener before reporting readiness.
  const command = new Promise((resolve) => process.once('message', resolve));
  await send({ phase: 'idle', ...await probe() });
  if (await command !== 'probe') throw new Error('Unexpected connection worker command');
  await send({ phase: 'recovered', ...await probe() });
} finally {
  await database.close();
  process.disconnect();
}
