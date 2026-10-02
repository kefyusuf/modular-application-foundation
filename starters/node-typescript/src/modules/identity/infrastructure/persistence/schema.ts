import type { SqlMigration } from '../../../../kernel/sql.js';

const statements = [
  'CREATE SCHEMA IF NOT EXISTS identity',
  `CREATE TABLE IF NOT EXISTS identity.users (
    id text PRIMARY KEY, email text NOT NULL UNIQUE,
    password_digest text NOT NULL, version integer NOT NULL CHECK (version > 0)
  )`,
  `CREATE TABLE IF NOT EXISTS identity.sessions (
    id text PRIMARY KEY, user_id text NOT NULL REFERENCES identity.users(id),
    refresh_digest text NOT NULL, expires_at bigint NOT NULL, revoked boolean NOT NULL DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
    digest text PRIMARY KEY, session_id text NOT NULL REFERENCES identity.sessions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS identity.outbox (
    id text PRIMARY KEY, event jsonb NOT NULL, envelope jsonb NOT NULL,
    occurred_at timestamptz NOT NULL, available_at timestamptz NOT NULL DEFAULT now(),
    claimed_until timestamptz, claim_id text, attempts integer NOT NULL DEFAULT 0,
    delivered_at timestamptz, last_error text
  )`,
  'CREATE INDEX IF NOT EXISTS outbox_pending_idx ON identity.outbox (available_at, occurred_at) WHERE delivered_at IS NULL',
];

export const identityMigrations: readonly SqlMigration[] = [
  { version: 1, name: 'initial_schema', statements },
];
