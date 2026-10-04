import { PostgresDatabase } from '../infrastructure/postgres.js';
import { runMigrations } from '../infrastructure/migrations.js';
import { identityMigrations } from '../modules/identity/infrastructure/persistence/schema.js';
import { auditMigrations } from '../modules/audit/infrastructure/schema.js';
import { notificationMigrations } from '../modules/notification/infrastructure/schema.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run migrations');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try {
  await database.withinTransaction(async () => {
    await runMigrations(database, 'identity', identityMigrations);
    await runMigrations(database, 'audit', auditMigrations);
    await runMigrations(database, 'notification', notificationMigrations);
  });
} finally { await database.close(); }
console.log('Identity, audit, and notification schema migration complete');
