import { PostgresDatabase } from '../infrastructure/postgres.js';
import { PostgresSessionStore } from '../modules/identity/infrastructure/auth/postgres-session-store.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to prune expired sessions');
const database = new PostgresDatabase(process.env.DATABASE_URL);
try {
  const removed = await new PostgresSessionStore(database).pruneExpired(Math.floor(Date.now() / 1000));
  console.log(`Expired session families removed: ${removed}`);
} finally { await database.close(); }
