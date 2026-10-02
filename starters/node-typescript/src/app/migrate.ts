import { PostgresDatabase } from '../infrastructure/postgres.js';
import { migrateIdentity } from '../modules/identity/infrastructure/persistence/schema.js';
import { migrateAudit } from '../modules/audit/infrastructure/schema.js';
import { migrateNotification } from '../modules/notification/infrastructure/schema.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run migrations');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try {
  await database.withinTransaction(async () => {
    await migrateIdentity(database);
    await migrateAudit(database);
    await migrateNotification(database);
  });
} finally { await database.close(); }
console.log('Identity, audit, and notification schema migration complete');
