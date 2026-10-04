import { PostgresDatabase } from '../infrastructure/postgres.js';
import { migrateIdentity } from '../modules/identity/infrastructure/persistence/schema.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run migrations');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try { await migrateIdentity(database); } finally { await database.close(); }
console.log('Identity schema migration complete');