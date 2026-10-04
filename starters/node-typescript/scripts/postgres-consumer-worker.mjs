import { PostgresDatabase } from '../dist/infrastructure/postgres.js';
import { PostgresOutboxDispatcher } from '../dist/modules/identity/infrastructure/persistence/postgres-outbox.js';
import { PostgresAuditLogger } from '../dist/modules/audit/infrastructure/postgres-audit-logger.js';
import { PostgresNotificationQueue } from '../dist/modules/notification/infrastructure/postgres-notification-queue.js';
import { createAuditSubscriber } from '../dist/modules/audit/application/on-user-registered.js';
import { createWelcomeEmailSubscriber } from '../dist/modules/notification/application/on-user-registered.js';
import { createSubscribingEventBus } from '../dist/kernel/event-router.js';

const mode = process.argv[2];
const target = new URL(process.env.FOUNDATION_POSTGRES_TEST_URL ?? 'invalid:');
if (!process.send || !['after-audit', 'after-effects', 'complete'].includes(mode)
  || target.protocol !== 'postgresql:' || target.hostname !== '127.0.0.1' || target.search || target.hash
  || target.username !== 'postgres' || !/^\/foundation_pg_test_[a-f0-9]{32}$/.test(target.pathname)) {
  throw new Error('Consumer worker requires IPC and a disposable PostgreSQL fixture');
}

const database = new PostgresDatabase(target.toString());
const send = (message) => new Promise((resolve, reject) => {
  process.send(message, (error) => error ? reject(error) : resolve());
});
let keepAlive;
async function checkpoint(phase) {
  if (mode !== phase) return;
  keepAlive = setInterval(() => {}, 1000);
  await send({ phase });
  // The parent kills this process after committed effects, before acknowledgement.
  await new Promise(() => {});
}

try {
  const delivery = createSubscribingEventBus({ publish: async () => {} }, [
    createAuditSubscriber(new PostgresAuditLogger(database)),
    async () => checkpoint('after-audit'),
    createWelcomeEmailSubscriber(new PostgresNotificationQueue(database)),
    async () => checkpoint('after-effects'),
  ]);
  const result = await new PostgresOutboxDispatcher(database, delivery).drain(1);
  await send({ phase: 'complete', result });
} finally {
  clearInterval(keepAlive);
  await database.close();
  process.disconnect();
}
