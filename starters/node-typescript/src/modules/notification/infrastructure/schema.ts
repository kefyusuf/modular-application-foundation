import type { SqlDatabase } from '../../../kernel/sql.js';

export async function migrateNotification(database: SqlDatabase): Promise<void> {
  await database.withinTransaction(async () => {
    await database.query('CREATE SCHEMA IF NOT EXISTS notification');
    await database.query(`CREATE TABLE IF NOT EXISTS notification.messages (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id text UNIQUE, message jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
      queued_at timestamptz NOT NULL DEFAULT now()
    )`);
  });
}
