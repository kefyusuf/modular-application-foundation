import type { SqlMigration } from '../../../kernel/sql.js';

export const auditMigrations: readonly SqlMigration[] = [{
  version: 1, name: 'initial_schema', statements: [
    'CREATE SCHEMA IF NOT EXISTS audit',
    `CREATE TABLE IF NOT EXISTS audit.entries (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id text UNIQUE, entry jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
    )`,
  ],
}];
