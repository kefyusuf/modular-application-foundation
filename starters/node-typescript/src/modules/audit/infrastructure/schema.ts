import type { SqlDatabase } from '../../../kernel/sql.js';

export async function migrateAudit(database: SqlDatabase): Promise<void> {
  await database.withinTransaction(async () => {
    await database.query('CREATE SCHEMA IF NOT EXISTS audit');
    await database.query(`CREATE TABLE IF NOT EXISTS audit.entries (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id text UNIQUE, entry jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
    )`);
  });
}
