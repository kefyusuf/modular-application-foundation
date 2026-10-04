import type { SqlMigration } from '../../../kernel/sql.js';

export const notificationMigrations: readonly SqlMigration[] = [{
  version: 1, name: 'initial_schema', statements: [
    'CREATE SCHEMA IF NOT EXISTS notification',
    `CREATE TABLE IF NOT EXISTS notification.messages (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id text UNIQUE, message jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
      queued_at timestamptz NOT NULL DEFAULT now()
    )`,
  ],
}];
