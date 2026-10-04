import { PostgresDatabase } from '../dist/infrastructure/postgres.js';
import { PostgresOutboxEventBus } from '../dist/modules/identity/infrastructure/persistence/postgres-outbox.js';

const target = new URL(process.env.FOUNDATION_POSTGRES_TEST_URL ?? 'invalid:');
if (!process.send || process.argv[2] !== 'transaction-gap' || target.protocol !== 'postgresql:'
  || target.hostname !== '127.0.0.1' || target.search || target.hash || target.username !== 'postgres'
  || !/^\/foundation_pg_test_[a-f0-9]{32}$/.test(target.pathname)) {
  throw new Error('Transaction worker requires IPC and a disposable PostgreSQL fixture');
}
const send = (message) => new Promise((resolve, reject) => {
  process.send(message, (error) => error ? reject(error) : resolve());
});
console.error = (...args) => { void send({ phase: 'transaction-error', args }).catch(() => {}); };
const database = new PostgresDatabase(target.toString());
let invocations = 0;
try {
  let failure;
  try {
    await database.withinTransaction(async () => {
      invocations++;
      await database.query("INSERT INTO identity.users VALUES ('interrupted', 'interrupted@example.com', 'fixture', 1)");
      await new PostgresOutboxEventBus(database).publish({ type: 'identity.user.registered.v1',
        occurredAt: new Date().toISOString(), data: { userId: 'interrupted', email: 'interrupted@example.com' } });
      const { rows } = await database.query('SELECT pg_backend_pid() AS pid');
      const command = new Promise((resolve) => process.once('message', resolve));
      await send({ phase: 'transaction-open', pid: rows[0].pid });
      if (await command !== 'resume') throw new Error('Unexpected transaction command');
      // Intentionally return normally: the transaction manager must still reject a lost connection.
    });
  } catch (error) { failure = error; }
  const recovery = new Promise((resolve) => process.once('message', resolve));
  await send({ phase: 'rejected', rejected: failure instanceof Error, code: failure?.code, invocations });
  if (await recovery !== 'recover') throw new Error('Unexpected recovery command');
  const pid = await database.withinTransaction(async () => {
    await database.query("INSERT INTO identity.users VALUES ('recovered', 'recovered@example.com', 'fixture', 1)");
    return (await database.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  });
  await send({ phase: 'recovered', pid, invocations });
} finally {
  await database.close();
  process.disconnect();
}
