import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SqlDatabase, SqlMigration, SqlResult } from '../kernel/sql.js';
import type { DomainEvent } from '../kernel/ports.js';
import { runMigrations } from './migrations.js';
import { identityMigrations } from '../modules/identity/infrastructure/persistence/schema.js';
import { auditMigrations } from '../modules/audit/infrastructure/schema.js';
import { notificationMigrations } from '../modules/notification/infrastructure/schema.js';
import { PostgresAuditLogger } from '../modules/audit/infrastructure/postgres-audit-logger.js';
import { PostgresNotificationQueue } from '../modules/notification/infrastructure/postgres-notification-queue.js';
import { PostgresUserRepository } from '../modules/identity/infrastructure/persistence/postgres-user-repository.js';
import { PostgresSessionStore } from '../modules/identity/infrastructure/auth/postgres-session-store.js';
import { PostgresOutboxEventBus, PostgresOutboxDispatcher } from '../modules/identity/infrastructure/persistence/postgres-outbox.js';
import { JwtTokenService } from '../modules/identity/infrastructure/auth/jwt-token-service.js';
import { RegisterUserHandler } from '../modules/identity/application/features/register-user/handler.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { LoginHandler } from '../modules/identity/application/features/login/handler.js';
import { LoginCommand } from '../modules/identity/application/features/login/command.js';
import { RefreshSessionHandler } from '../modules/identity/application/features/refresh-session/handler.js';
import { RefreshSessionCommand } from '../modules/identity/application/features/refresh-session/command.js';
import { LogoutHandler } from '../modules/identity/application/features/logout/handler.js';
import { LogoutCommand } from '../modules/identity/application/features/logout/command.js';
import { InMemorySettingStore } from '../modules/settings/infrastructure/in-memory-setting-store.js';
import { createApplication } from '../app/application.js';
import { InMemoryAuditLogger } from '../modules/audit/infrastructure/in-memory-audit-logger.js';
import { InMemoryNotificationSender } from '../modules/notification/infrastructure/in-memory-notification-sender.js';
import { createAuditSubscriber } from '../modules/audit/application/on-user-registered.js';
import { createWelcomeEmailSubscriber } from '../modules/notification/application/on-user-registered.js';
import { createSubscribingEventBus } from '../kernel/event-router.js';

const migrateIdentity = (database: SqlDatabase) => runMigrations(database, 'identity', identityMigrations);
const migrateAudit = (database: SqlDatabase) => runMigrations(database, 'audit', auditMigrations);
const migrateNotification = (database: SqlDatabase) => runMigrations(database, 'notification', notificationMigrations);

const initialFixture: SqlMigration = {
  version: 1, name: 'create_counter', statements: [
    'CREATE TABLE migration_fixture.counter (value integer NOT NULL)',
    'INSERT INTO migration_fixture.counter VALUES (1)',
  ],
};

// Exercise the production SQL repositories/schema against PostgreSQL compiled to WASM.
// PGlite has one connection; this suite does not simulate independent PostgreSQL backends.
class EmbeddedPostgres implements SqlDatabase {
  private readonly context = new AsyncLocalStorage<Transaction>();
  private readonly engine: PGlite;
  constructor(directory: string) { this.engine = new PGlite(directory); }

  async query<Row extends object>(sql: string, values: unknown[] = []): Promise<SqlResult<Row>> {
    const result = await (this.context.getStore() ?? this.engine).query<Row>(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }

  async withinTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    return this.engine.transaction((transaction) => this.context.run(transaction, fn));
  }

  async close() { await this.engine.close(); }
}

describe('PostgreSQL persistence and outbox', () => {
  let directory: string;
  let database: EmbeddedPostgres;
  let users: PostgresUserRepository;
  let events: PostgresOutboxEventBus;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'foundation-pg-test-'));
    database = new EmbeddedPostgres(directory);
    await migrateIdentity(database);
    await migrateAudit(database);
    await migrateNotification(database);
  }, 30000);

  beforeEach(async () => {
    await database.query('DROP SCHEMA IF EXISTS migration_fixture CASCADE');
    await database.query('TRUNCATE identity.refresh_tokens, identity.sessions, identity.outbox, identity.users, audit.entries, notification.messages');
    users = new PostgresUserRepository(database);
    events = new PostgresOutboxEventBus(database);
  });

  afterAll(async () => {
    await database?.close();
    if (directory) {
      const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
      if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('foundation-pg-test-')) throw new Error('Unsafe test cleanup path');
      await rm(directory, { recursive: true, force: true });
    }
  }, 30000);

  async function register(email = 'user@example.com', id = 'user-1') {
    return new RegisterUserHandler(users, events, database).execute(new RegisterUserCommand(email, 'demo-credential', id));
  }

  it('prunes bounded expired SQL families atomically while keeping live replay history', async () => {
    await register();
    const sessions = new PostgresSessionStore(database);
    for (const [id, expiry, revoked] of [['expired', 99, false], ['boundary', 100, true], ['active', 101, false], ['revoked-live', 102, true]] as const) {
      await sessions.create({ id, userId: 'user-1', refreshDigest: `${id}-old`, expiresAt: expiry, revoked });
    }
    await sessions.rotate('expired-old', 'expired-current', 98);
    await sessions.rotate('active-old', 'active-current', 98);
    expect(await sessions.pruneExpired(100, 1)).toBe(1);
    expect(await sessions.get('expired')).toBeNull();
    expect((await database.query(`SELECT digest FROM identity.refresh_tokens WHERE session_id = 'expired'`)).rows).toEqual([]);
    expect(await sessions.get('boundary')).not.toBeNull();
    expect(await sessions.pruneExpired(100, 1)).toBe(1);
    expect(await sessions.pruneExpired(100, 1)).toBe(0);
    expect(await sessions.get('revoked-live')).not.toBeNull();
    await expect(sessions.rotate('active-old', 'invalid-replay', 100)).rejects.toThrow('Invalid credentials');
    expect(await sessions.get('active')).toMatchObject({ revoked: true });
    expect((await database.query(`SELECT id FROM identity.users`)).rows).toEqual([{ id: 'user-1' }]);
    expect((await database.query('SELECT id FROM identity.outbox')).rows).toHaveLength(1);
  });

  it('rolls back both session and refresh history cleanup with an enclosing transaction failure', async () => {
    await register();
    const sessions = new PostgresSessionStore(database);
    await sessions.create({ id: 'expired', userId: 'user-1', refreshDigest: 'old-digest', expiresAt: 100, revoked: false });
    await sessions.rotate('old-digest', 'current-digest', 99);
    await expect(database.withinTransaction(async () => {
      expect(await sessions.pruneExpired(100)).toBe(1);
      throw new Error('Simulated maintenance failure');
    })).rejects.toThrow('Simulated maintenance failure');
    expect(await sessions.get('expired')).not.toBeNull();
    expect((await database.query(`SELECT digest FROM identity.refresh_tokens WHERE session_id = 'expired' ORDER BY digest`)).rows).toEqual([{ digest: 'current-digest' }, { digest: 'old-digest' }]);
  });

  it('exposes bounded session cleanup through application composition', async () => {
    await register();
    await new PostgresSessionStore(database).create({ id: 'expired', userId: 'user-1', refreshDigest: 'digest', expiresAt: 100, revoked: false });
    const app = await createApplication({ database, tokenKeys: { activeKeyId: 'test', keys: { test: randomBytes(32) } } });
    expect(await app.pruneExpiredSessions(100, 1)).toBe(1);
    expect(await app.pruneExpiredSessions(100, 1)).toBe(0);
  });

  it.each([[-1, 1], [100.5, 1], [Number.NaN, 1], [100, 0], [100, 1.5], [100, 1001]])('rejects unsafe SQL cleanup cutoff %s or limit %s without removing state', async (now, limit) => {
    await register();
    const sessions = new PostgresSessionStore(database);
    await sessions.create({ id: 'expired', userId: 'user-1', refreshDigest: 'digest', expiresAt: 1, revoked: false });
    await expect(sessions.pruneExpired(now, limit)).rejects.toThrow('Invalid session cleanup parameters');
    expect(await sessions.get('expired')).not.toBeNull();
    expect((await database.query('SELECT digest FROM identity.refresh_tokens')).rows).toEqual([{ digest: 'digest' }]);
  });

  it.each(['identity', 'audit', 'notification'])('records the initial %s schema migration', async (module) => {
    const { rows } = await database.query<{ name: string | null }>('SELECT to_regclass($1)::text AS name', [`${module}.schema_migrations`]);
    expect(rows[0].name).toBe(`${module}.schema_migrations`);
    const history = await database.query(`SELECT version, name FROM ${module}.schema_migrations`);
    expect(history.rows).toEqual([{ version: 1, name: 'initial_schema' }]);
  });

  it('applies only new migrations and retains their history across a database reopen', async () => {
    await runMigrations(database, 'migration_fixture', [initialFixture]);
    const upgrade = { version: 2, name: 'increment_counter', statements: ['UPDATE migration_fixture.counter SET value = value + 1'] };
    await runMigrations(database, 'migration_fixture', [initialFixture, upgrade]);
    await database.close();
    database = new EmbeddedPostgres(directory);
    await runMigrations(database, 'migration_fixture', [initialFixture, upgrade]);
    expect((await database.query('SELECT value FROM migration_fixture.counter')).rows).toEqual([{ value: 2 }]);
    expect((await database.query('SELECT version, name FROM migration_fixture.schema_migrations ORDER BY version')).rows).toEqual([
      { version: 1, name: 'create_counter' }, { version: 2, name: 'increment_counter' },
    ]);
  }, 30000);

  it.each(['name', 'statements'] as const)('rejects edits to an applied migration %s before running pending SQL', async (field) => {
    await runMigrations(database, 'migration_fixture', [initialFixture]);
    const changed = field === 'name' ? { ...initialFixture, name: 'renamed' } : { ...initialFixture, statements: ['DELETE FROM migration_fixture.counter'] };
    const pending = { version: 2, name: 'delete_counter', statements: ['DELETE FROM migration_fixture.counter'] };
    await expect(runMigrations(database, 'migration_fixture', [changed, pending])).rejects.toThrow('Applied migration changed');
    expect((await database.query('SELECT value FROM migration_fixture.counter')).rows).toEqual([{ value: 1 }]);
    expect((await database.query('SELECT version FROM migration_fixture.schema_migrations')).rows).toEqual([{ version: 1 }]);
  });

  it('rejects a removed applied migration instead of accepting an older catalog', async () => {
    await runMigrations(database, 'migration_fixture', [initialFixture]);
    await expect(runMigrations(database, 'migration_fixture', [])).rejects.toThrow('Migration history does not match catalog');
  });

  it('rejects insertion of an older migration before an already applied higher version', async () => {
    const third = { version: 3, name: 'increment_counter', statements: ['UPDATE migration_fixture.counter SET value = value + 1'] };
    await runMigrations(database, 'migration_fixture', [initialFixture, third]);
    const late = { version: 2, name: 'late_insert', statements: ['DELETE FROM migration_fixture.counter'] };
    await expect(runMigrations(database, 'migration_fixture', [initialFixture, late, third])).rejects.toThrow('Migration history does not match catalog');
    expect((await database.query('SELECT value FROM migration_fixture.counter')).rows).toEqual([{ value: 2 }]);
  });

  it.each([
    ['duplicate versions', [initialFixture, initialFixture]],
    ['descending versions', [{ ...initialFixture, version: 2 }, initialFixture]],
    ['zero version', [{ ...initialFixture, version: 0 }]],
    ['fractional version', [{ ...initialFixture, version: 1.5 }]],
    ['empty name', [{ ...initialFixture, name: '' }]],
  ] as const)('rejects %s before writing schema or executing SQL', async (_name, catalog) => {
    await expect(runMigrations(database, 'migration_fixture', catalog)).rejects.toThrow('Invalid migration catalog');
    expect((await database.query('SELECT to_regnamespace($1)::text AS name', ['migration_fixture'])).rows).toEqual([{ name: null }]);
  });

  it('rejects unsafe schema identifiers before issuing SQL', async () => {
    await expect(runMigrations(database, 'invalid-schema', [initialFixture])).rejects.toThrow('Invalid migration schema');
  });

  it.each(['statement', 'history'] as const)('rolls back pending changes when a migration %s write fails', async (failure) => {
    await runMigrations(database, 'migration_fixture', [initialFixture]);
    if (failure === 'history') await database.query(`ALTER TABLE migration_fixture.schema_migrations ADD CONSTRAINT reject_receipt CHECK (name <> 'upgrade')`);
    const statements = ['ALTER TABLE migration_fixture.counter ADD COLUMN upgraded boolean NOT NULL DEFAULT true'];
    if (failure === 'statement') statements.push('INSERT INTO migration_fixture.missing_table VALUES (1)');
    await expect(runMigrations(database, 'migration_fixture', [initialFixture, { version: 2, name: 'upgrade', statements }])).rejects.toThrow();
    expect((await database.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'migration_fixture' AND table_name = 'counter' ORDER BY ordinal_position`)).rows).toEqual([{ column_name: 'value' }]);
    expect((await database.query('SELECT version FROM migration_fixture.schema_migrations')).rows).toEqual([{ version: 1 }]);
  });

  it('rolls back the entire pending batch when a later migration fails', async () => {
    await runMigrations(database, 'migration_fixture', [initialFixture]);
    const second = { version: 2, name: 'increment_counter', statements: ['UPDATE migration_fixture.counter SET value = value + 1'] };
    const third = { version: 3, name: 'broken_upgrade', statements: ['INSERT INTO migration_fixture.missing_table VALUES (1)'] };
    await expect(runMigrations(database, 'migration_fixture', [initialFixture, second, third])).rejects.toThrow();
    expect((await database.query('SELECT value FROM migration_fixture.counter')).rows).toEqual([{ value: 1 }]);
    expect((await database.query('SELECT version FROM migration_fixture.schema_migrations')).rows).toEqual([{ version: 1 }]);
  });

  it('adopts the earlier unversioned schemas without discarding users, sessions, or consumer effects', async () => {
    await register();
    const keys = { activeKeyId: 'stable', keys: { stable: randomBytes(32) } };
    const tokens = new JwtTokenService(undefined, keys, new PostgresSessionStore(database));
    const login = await tokens.issue('user-1');
    const app = await createApplication({ database, tokenKeys: keys });
    await app.outbox!.drain();
    await database.query('DROP TABLE identity.schema_migrations, audit.schema_migrations, notification.schema_migrations');
    await database.withinTransaction(async () => {
      await migrateIdentity(database);
      await migrateAudit(database);
      await migrateNotification(database);
    });
    expect((await users.get('user-1')).email.value).toBe('user@example.com');
    await expect(tokens.verify(login.access_token)).resolves.toMatchObject({ id: 'user-1' });
    expect(await app.audit.list()).toHaveLength(1);
    expect(await app.notifications.list()).toHaveLength(1);
    expect((await database.query('SELECT version FROM identity.schema_migrations')).rows).toEqual([{ version: 1 }]);
  });

  it.each(['sessions', 'refresh_tokens', 'outbox'] as const)('rejects startup when the identity %s table is missing', async (table) => {
    await database.query(`ALTER TABLE identity.${table} RENAME TO unavailable_${table}`);
    try {
      const outcome = await createApplication({ database, tokenKeys: { activeKeyId: 'test', keys: { test: randomBytes(32) } } }).then(() => 'started', () => 'rejected');
      expect(outcome).toBe('rejected');
    } finally {
      await database.query(`ALTER TABLE identity.unavailable_${table} RENAME TO ${table}`);
    }
  });

  it('commits the user and integration envelope together, and restores without new domain events', async () => {
    await register('User@Example.com');
    const restored = await users.get('user-1');
    expect(restored.email.value).toBe('user@example.com');
    expect(restored.pullDomainEvents()).toEqual([]);
    const { rows } = await database.query<{ envelope: { specversion: string; type: string; data: object }; delivered_at: unknown }>('SELECT envelope, delivered_at FROM identity.outbox');
    expect(rows).toHaveLength(1);
    expect(rows[0].envelope).toMatchObject({ specversion: '1.0', type: 'identity.user.registered.v1', data: { user_id: 'user-1', email: 'user@example.com' } });
    expect(rows[0].delivered_at).toBeNull();
  });

  it('rolls back the user when the outbox write fails', async () => {
    await database.query(`ALTER TABLE identity.outbox ADD CONSTRAINT reject_events CHECK (false)`);
    try {
      await expect(register()).rejects.toThrow();
      expect(await users.findByEmail('user@example.com')).toBeNull();
      expect((await database.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
    } finally { await database.query('ALTER TABLE identity.outbox DROP CONSTRAINT reject_events'); }
  });

  it('enforces normalized email uniqueness and optimistic concurrency without extra events', async () => {
    await register();
    await expect(register('USER@example.com', 'user-2')).rejects.toThrow('Email already used');
    const user = await users.get('user-1');
    await users.save(user, 1);
    await expect(users.save(user, 1)).rejects.toThrow('Concurrency conflict');
    expect((await database.query('SELECT id FROM identity.outbox')).rows).toHaveLength(1);
  });

  it('retains committed users, sessions, consumed token history, and pending events after reopening', async () => {
    await register();
    const keys = { activeKeyId: 'stable', keys: { stable: randomBytes(32) } };
    const tokens = new JwtTokenService(undefined, keys, new PostgresSessionStore(database));
    const original = await tokens.issue('user-1');
    const rotated = await tokens.refresh(original.refresh_token);
    await database.close();
    database = new EmbeddedPostgres(directory);
    const reopened = await createApplication({ database, tokenKeys: keys });
    expect((await reopened.users.get('user-1')).email.value).toBe('user@example.com');
    const restartedTokens = new JwtTokenService(undefined, keys, new PostgresSessionStore(database));
    await expect(restartedTokens.verify(rotated.access_token)).resolves.toMatchObject({ id: 'user-1' });
    await expect(restartedTokens.refresh(original.refresh_token)).rejects.toThrow('Invalid credentials');
    await expect(restartedTokens.verify(rotated.access_token)).rejects.toThrow('Invalid credentials');
    expect((await reopened.audit.list())).toEqual([]);
    expect(await reopened.outbox!.drain()).toEqual({ delivered: 1, failed: 0 });
    expect((await reopened.audit.list())).toHaveLength(1);
    expect((await reopened.notifications.list())).toHaveLength(1);
  }, 30000);

  it('retries failed delivery and acknowledges only successful subscriber completion', async () => {
    await register();
    let attempts = 0;
    const received: DomainEvent[] = [];
    const dispatcher = new PostgresOutboxDispatcher(database, { publish: async (event) => {
      attempts++;
      received.push(event);
      if (attempts === 1) throw new Error('Simulated subscriber failure');
    } });
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 1 });
    expect((await database.query('SELECT delivered_at FROM identity.outbox')).rows[0]).toEqual({ delivered_at: null });
    await database.query(`UPDATE identity.outbox SET available_at = now() - interval '1 second'`);
    expect(await dispatcher.drain()).toEqual({ delivered: 1, failed: 0 });
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 0 });
    expect(received).toHaveLength(2);
  });

  it('recovers expired claims after a worker disappears', async () => {
    await register();
    await database.query(`UPDATE identity.outbox SET claim_id = 'lost-worker', claimed_until = now() + interval '1 minute'`);
    const received: DomainEvent[] = [];
    const dispatcher = new PostgresOutboxDispatcher(database, { publish: async (event) => { received.push(event); } });
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 0 });
    await database.query(`UPDATE identity.outbox SET claimed_until = now() - interval '1 second'`);
    expect(await dispatcher.drain()).toEqual({ delivered: 1, failed: 0 });
    expect(received).toHaveLength(1);
  });

  it('retains producer event context through failed delivery and a worker restart', async () => {
    const context = { requestId: 'origin-request', correlationId: 'origin-workflow' };
    await events.publish({ type: 'identity.user.registered.v1', occurredAt: new Date().toISOString(), data: { userId: 'user-1', email: 'context@example.com' }, context });
    const failed = new PostgresOutboxDispatcher(database, { publish: async () => { throw new Error('Delivery unavailable'); } });
    expect(await failed.drain()).toEqual({ delivered: 0, failed: 1 });
    await database.close();
    database = new EmbeddedPostgres(directory);
    await database.query(`UPDATE identity.outbox SET available_at = now() - interval '1 second'`);
    const received: DomainEvent[] = [];
    expect(await new PostgresOutboxDispatcher(database, { publish: async (event) => { received.push(event); } }).drain()).toEqual({ delivered: 1, failed: 0 });
    expect(received[0]).toMatchObject({ context });
    const stored = await database.query<{ envelope: Record<string, unknown> }>('SELECT envelope FROM identity.outbox');
    expect(stored.rows[0].envelope).toMatchObject({ correlationid: 'origin-workflow', causationid: 'origin-request' });
  }, 30000);

  it('uses stable delivery IDs to avoid repeating successful consumer effects on retry', async () => {
    await register();
    const audit = new InMemoryAuditLogger();
    const notifications = new InMemoryNotificationSender();
    let failure = true;
    const dispatcher = new PostgresOutboxDispatcher(database, createSubscribingEventBus({ publish: async () => {} }, [
      createAuditSubscriber(audit), createWelcomeEmailSubscriber(notifications),
      async () => { if (failure) { failure = false; throw new Error('Failure after both consumers'); } },
    ]));
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 1 });
    await database.query(`UPDATE identity.outbox SET available_at = now() - interval '1 second'`);
    expect(await dispatcher.drain()).toEqual({ delivered: 1, failed: 0 });
    expect(audit.entries).toHaveLength(1);
    expect(notifications.sent).toHaveLength(1);
  });

  it('retains consumer effects and deduplication after a crash before outbox acknowledgement', async () => {
    await register();
    const keys = { activeKeyId: 'stable', keys: { stable: randomBytes(32) } };
    const first = await createApplication({ database, tokenKeys: keys });
    const dispatcher = new PostgresOutboxDispatcher(database, createSubscribingEventBus({ publish: async () => {} }, [
      createAuditSubscriber(first.audit), createWelcomeEmailSubscriber(first.notifications),
      async () => { throw new Error('Crash after effects, before acknowledgement'); },
    ]));
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 1 });
    await first.close();
    database = new EmbeddedPostgres(directory);
    const restarted = await createApplication({ database, tokenKeys: keys });
    expect(await restarted.audit.list()).toHaveLength(1);
    expect(await restarted.notifications.list()).toHaveLength(1);
    await database.query(`UPDATE identity.outbox SET available_at = now() - interval '1 second'`);
    expect(await restarted.outbox!.drain()).toEqual({ delivered: 1, failed: 0 });
    expect(await restarted.audit.list()).toHaveLength(1);
    expect(await restarted.notifications.list()).toHaveLength(1);
    expect((await database.query('SELECT status FROM notification.messages')).rows).toEqual([{ status: 'pending' }]);
  }, 30000);

  it('resumes a partially completed delivery after restart without repeating the audit effect', async () => {
    await register();
    const dispatcher = new PostgresOutboxDispatcher(database, createSubscribingEventBus({ publish: async () => {} }, [
      createAuditSubscriber(new PostgresAuditLogger(database)),
      async () => { throw new Error('Notification consumer unavailable'); },
    ]));
    expect(await dispatcher.drain()).toEqual({ delivered: 0, failed: 1 });
    expect(await new PostgresNotificationQueue(database).list()).toEqual([]);
    await database.close();
    database = new EmbeddedPostgres(directory);
    const restarted = await createApplication({ database, tokenKeys: { activeKeyId: 'test', keys: { test: randomBytes(32) } } });
    await database.query(`UPDATE identity.outbox SET available_at = now() - interval '1 second'`);
    expect(await restarted.outbox!.drain()).toEqual({ delivered: 1, failed: 0 });
    expect(await restarted.audit.list()).toHaveLength(1);
    expect(await restarted.notifications.list()).toHaveLength(1);
  }, 30000);

  it.each(['audit', 'notification'] as const)('does not retain a delivery receipt when the %s effect fails', async (consumer) => {
    const entry = { action: 'test', actorId: 'actor', subject: 'user', occurredAt: new Date().toISOString(), data: {} };
    const message = { channel: 'email' as const, to: 'user@example.com', subject: 'Welcome', body: 'Test' };
    const audit = new PostgresAuditLogger(database);
    const queue = new PostgresNotificationQueue(database);
    const table = consumer === 'audit' ? 'audit.entries' : 'notification.messages';
    const deliver = () => consumer === 'audit' ? audit.record(entry, 'event-1') : queue.send(message, 'event-1');
    await database.query(`ALTER TABLE ${table} ADD CONSTRAINT reject_effect CHECK (false)`);
    try {
      await expect(deliver()).rejects.toThrow();
      expect((await database.query(`SELECT event_id FROM ${table}`)).rows).toEqual([]);
    } finally { await database.query(`ALTER TABLE ${table} DROP CONSTRAINT reject_effect`); }
    await deliver();
    await deliver();
    expect((await database.query(`SELECT event_id FROM ${table}`)).rows).toEqual([{ event_id: 'event-1' }]);
  });

  it('deduplicates by delivery ID independently per consumer, not by message contents', async () => {
    const audit = new PostgresAuditLogger(database);
    const queue = new PostgresNotificationQueue(database);
    const event = { id: 'event-1', type: 'identity.user.registered.v1', occurredAt: new Date().toISOString(), data: { userId: 'user-1', email: 'user@example.com' } };
    for (const id of ['event-1', 'event-1', 'event-2', undefined, undefined]) {
      await createAuditSubscriber(audit)({ ...event, id });
      await createWelcomeEmailSubscriber(queue)({ ...event, id });
    }
    expect(await audit.list()).toHaveLength(4);
    expect(await queue.list()).toHaveLength(4);
  });

  it('can reapply consumer schema initialization without discarding existing effects', async () => {
    await register();
    const app = await createApplication({ database, tokenKeys: { activeKeyId: 'test', keys: { test: randomBytes(32) } } });
    await app.outbox!.drain();
    await migrateAudit(database);
    await migrateNotification(database);
    expect(await app.audit.list()).toHaveLength(1);
    expect(await app.notifications.list()).toHaveLength(1);
  });

  it('commits replay revocation and its outbox event despite returning an authentication error', async () => {
    await register();
    const tokens = new JwtTokenService(undefined, undefined, new PostgresSessionStore(database));
    const original = await tokens.issue('user-1');
    const handler = new RefreshSessionHandler(users, tokens, events, database);
    const rotated = await handler.execute(new RefreshSessionCommand(original.refresh_token));
    await expect(handler.execute(new RefreshSessionCommand(original.refresh_token))).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(rotated.access_token)).rejects.toThrow('Invalid credentials');
    const { rows } = await database.query<{ event: DomainEvent }>(`SELECT event FROM identity.outbox WHERE event->>'type' = 'identity.session.revoked.v1'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].event.data.reason).toBe('refresh_token_reuse');
  });

  it('rolls back logout revocation if its outbox write fails', async () => {
    await register();
    const tokens = new JwtTokenService(undefined, undefined, new PostgresSessionStore(database));
    const original = await tokens.issue('user-1');
    await database.query(`ALTER TABLE identity.outbox ADD CONSTRAINT reject_revocations CHECK (event->>'type' <> 'identity.session.revoked.v1')`);
    try {
      await expect(new LogoutHandler(tokens, events, database).execute(new LogoutCommand(original.access_token))).rejects.toThrow();
      await expect(tokens.verify(original.access_token)).resolves.toMatchObject({ id: 'user-1' });
    } finally { await database.query('ALTER TABLE identity.outbox DROP CONSTRAINT reject_revocations'); }
    await new LogoutHandler(tokens, events, database).execute(new LogoutCommand(original.access_token));
    await expect(tokens.verify(original.access_token)).rejects.toThrow('Invalid credentials');
  });

  it('retains failed-login events even though the handler rejects authentication', async () => {
    await register();
    const handler = new LoginHandler(users, events, database, new InMemorySettingStore());
    await expect(handler.execute(new LoginCommand('user@example.com', 'wrong-credential'))).rejects.toThrow('Invalid credentials');
    expect((await database.query(`SELECT id FROM identity.outbox WHERE event->>'type' = 'identity.user.login_failed.v1'`)).rows).toHaveLength(1);
  });

  it('wires HTTP registration, authentication, and logout to SQL with deferred subscribers', async () => {
    const app = await createApplication({ database, tokenKeys: { activeKeyId: 'test', keys: { test: randomBytes(32) } } });
    const server = createServer((req, res) => { void app.handler(req, res); });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const credentials = { email: 'http@example.com', password: 'a-long-password' };
    const registerViaHttp = () => fetch(`${baseUrl}/api/v1/identity/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin', 'x-request-id': 'register-request', 'x-correlation-id': 'account-workflow' }, body: JSON.stringify(credentials),
    });
    try {
      const registration = await registerViaHttp();
      expect(registration.status).toBe(201);
      await registration.json();
      const stored = await database.query<{ event: DomainEvent; envelope: Record<string, unknown> }>('SELECT event, envelope FROM identity.outbox');
      expect(stored.rows[0].event).toMatchObject({ context: { requestId: 'register-request', correlationId: 'account-workflow' } });
      expect(stored.rows[0].envelope).toMatchObject({ correlationid: 'account-workflow', causationid: 'register-request' });
      const duplicate = await registerViaHttp();
      expect(duplicate.status).toBe(409);
      await duplicate.json();
      expect((await app.audit.list())).toEqual([]);
      const response = await fetch(`${baseUrl}/api/v1/identity/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'login-request', 'x-correlation-id': 'account-workflow' }, body: JSON.stringify(credentials),
      });
      expect(response.status).toBe(200);
      const login = await response.json();
      const loginEvent = await database.query<{ event: DomainEvent }>(`SELECT event FROM identity.outbox WHERE event->>'type' = 'identity.user.login_succeeded.v1'`);
      expect(loginEvent.rows[0].event).toMatchObject({ context: { requestId: 'login-request', correlationId: 'account-workflow' } });
      const auth = { authorization: `Bearer ${login.data.access_token}` };
      const me = await fetch(`${baseUrl}/api/v1/identity/me`, { headers: auth });
      expect(me.status).toBe(200);
      expect((await me.json()).data.email).toBe(credentials.email);
      expect(await app.outbox!.drain()).toEqual({ delivered: 2, failed: 0 });
      expect((await app.audit.list())).toHaveLength(1);
      expect((await app.audit.list())[0]).toMatchObject({ context: { requestId: 'register-request', correlationId: 'account-workflow' } });
      expect((await app.notifications.list())).toHaveLength(1);
      const logout = await fetch(`${baseUrl}/api/v1/identity/auth/logout`, { method: 'POST', headers: { ...auth, 'x-request-id': 'logout-request', 'x-correlation-id': 'account-workflow' } });
      expect(logout.status).toBe(204);
      const rejected = await fetch(`${baseUrl}/api/v1/identity/me`, { headers: auth });
      expect(rejected.status).toBe(401);
      await rejected.json();
      expect(await app.outbox!.drain()).toEqual({ delivered: 1, failed: 0 });
      expect((await app.audit.list()).filter((entry) => entry.action === 'identity.session.revoked')).toHaveLength(1);
      expect((await app.audit.list()).find((entry) => entry.action === 'identity.session.revoked')).toMatchObject({ context: { requestId: 'logout-request', correlationId: 'account-workflow' } });
      await register('background@example.com', 'background-user');
      const background = await database.query<{ event: DomainEvent; envelope: { id: string; correlationid: string; causationid?: string } }>(`SELECT event, envelope FROM identity.outbox WHERE event->'data'->>'email' = 'background@example.com'`);
      expect(background.rows[0].event.context).toBeUndefined();
      expect(background.rows[0].envelope.correlationid).toBe(background.rows[0].envelope.id);
      expect(background.rows[0].envelope.causationid).toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  });
});
