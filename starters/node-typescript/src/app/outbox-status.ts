import { PostgresDatabase } from '../infrastructure/postgres.js';
import { PostgresOutboxStatusReader } from '../modules/identity/infrastructure/persistence/postgres-outbox-status.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to read outbox status');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try {
  console.log(JSON.stringify(await new PostgresOutboxStatusReader(database).read()));
} finally { await database.close(); }
