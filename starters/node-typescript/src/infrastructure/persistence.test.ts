import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SqlDatabase, SqlResult } from '../kernel/sql.js';
import type { DomainEvent } from '../kernel/ports.js';
import { migrateIdentity } from '../modules/identity/infrastructure/persistence/schema.js';
import { migrateAudit } from '../modules/audit/infrastructure/schema.js';
import { migrateNotification } from '../modules/notification/infrastructure/schema.js';
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
    const register = () => fetch(`${baseUrl}/api/v1/identity/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin' }, body: JSON.stringify(credentials),
    });
    try {
      const registration = await register();
      expect(registration.status).toBe(201);
      await registration.json();
      const duplicate = await register();
      expect(duplicate.status).toBe(409);
      await duplicate.json();
      expect((await app.audit.list())).toEqual([]);
      const response = await fetch(`${baseUrl}/api/v1/identity/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials),
      });
      expect(response.status).toBe(200);
      const login = await response.json();
      const auth = { authorization: `Bearer ${login.data.access_token}` };
      const me = await fetch(`${baseUrl}/api/v1/identity/me`, { headers: auth });
      expect(me.status).toBe(200);
      expect((await me.json()).data.email).toBe(credentials.email);
      expect(await app.outbox!.drain()).toEqual({ delivered: 2, failed: 0 });
      expect((await app.audit.list())).toHaveLength(1);
      expect((await app.notifications.list())).toHaveLength(1);
      const logout = await fetch(`${baseUrl}/api/v1/identity/auth/logout`, { method: 'POST', headers: auth });
      expect(logout.status).toBe(204);
      const rejected = await fetch(`${baseUrl}/api/v1/identity/me`, { headers: auth });
      expect(rejected.status).toBe(401);
      await rejected.json();
      expect(await app.outbox!.drain()).toEqual({ delivered: 1, failed: 0 });
      expect((await app.audit.list()).filter((entry) => entry.action === 'identity.session.revoked')).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  });
});
