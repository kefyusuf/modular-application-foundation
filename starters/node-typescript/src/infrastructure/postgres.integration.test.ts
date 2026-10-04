import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout } from 'node:timers/promises';
import { PostgresDatabase } from './postgres.js';
import { runMigrations } from './migrations.js';
import { identityMigrations } from '../modules/identity/infrastructure/persistence/schema.js';
import { PostgresSessionStore } from '../modules/identity/infrastructure/auth/postgres-session-store.js';
import { RefreshTokenReuseError } from '../modules/identity/public/auth-contracts.js';
import { PostgresOutboxDispatcher, PostgresOutboxEventBus } from '../modules/identity/infrastructure/persistence/postgres-outbox.js';
import { PostgresOutboxStatusReader } from '../modules/identity/infrastructure/persistence/postgres-outbox-status.js';

const connectionString = process.env.FOUNDATION_POSTGRES_TEST_URL;

function validateFixture(connection: string): void {
  const target = new URL(connection);
  if (target.protocol !== 'postgresql:' || target.hostname !== '127.0.0.1' || target.search || target.hash
    || !/^\/foundation_pg_test_[a-f0-9]{32}$/.test(target.pathname) || target.username !== 'postgres') {
    throw new Error('External PostgreSQL tests require a disposable loopback fixture');
  }
}

describe('PostgreSQL fixture target guard', () => {
  const safe = `postgresql://postgres@127.0.0.1:54321/foundation_pg_test_${'a'.repeat(32)}`;
  it('accepts the generated disposable loopback target', () => {
    expect(() => validateFixture(safe)).not.toThrow();
  });
  it.each([
    safe.replace('127.0.0.1', 'example.invalid'),
    safe.replace(/foundation_pg_test_a+$/, 'application'),
    safe.replace('postgresql:', 'https:'),
    `${safe}?host=example.invalid&user=other`,
  ])('rejects an unsafe database target: %s', (target) => {
    expect(() => validateFixture(target)).toThrow('disposable loopback fixture');
  });
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function waitUntilReady(ready: ReturnType<typeof gate>, worker: Promise<unknown>) {
  await Promise.race([ready.promise, worker.then(() => { throw new Error('Worker stopped before reaching the gate'); })]);
}

describe.skipIf(!connectionString)('external PostgreSQL connections', () => {
  let first: PostgresDatabase;
  let second: PostgresDatabase;

  beforeAll(async () => {
    // Only the disposable, loopback fixture created by test:postgres is accepted.
    validateFixture(connectionString!);
    first = new PostgresDatabase(connectionString!);
    second = new PostgresDatabase(connectionString!);
    await runMigrations(first, 'identity', identityMigrations);
  }, 15000);

  beforeEach(async () => {
    await first.query('TRUNCATE identity.refresh_tokens, identity.sessions, identity.outbox, identity.users');
    await first.query("INSERT INTO identity.users VALUES ('user-1', 'user@example.com', 'fixture', 1)");
  });

  afterAll(async () => { await Promise.all([first?.close(), second?.close()]); });

  async function session(id: string, expiresAt = 100) {
    await new PostgresSessionStore(first).create({ id, userId: 'user-1', refreshDigest: `${id}-old`, expiresAt, revoked: false });
  }

  it('uses independent PostgreSQL backends over the driver connection', async () => {
    const one = await first.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const two = await second.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    expect(one.rows[0].pid).not.toBe(two.rows[0].pid);
  });

  it('rolls back nested session writes with their enclosing transaction', async () => {
    await expect(first.withinTransaction(async () => {
      await session('rolled-back');
      expect(await new PostgresSessionStore(first).get('rolled-back')).not.toBeNull();
      throw new Error('Abort enclosing transaction');
    })).rejects.toThrow('Abort enclosing transaction');
    expect(await new PostgresSessionStore(second).get('rolled-back')).toBeNull();
    expect((await second.query('SELECT * FROM identity.refresh_tokens')).rows).toEqual([]);
    // The pooled connection remains usable after rollback.
    await session('committed');
    expect(await new PostgresSessionStore(second).get('committed')).not.toBeNull();
  });

  it('isolates concurrent transaction context from queries outside its async scope', async () => {
    const ready = gate();
    const resume = gate();
    const transaction = first.withinTransaction(async () => {
      await session('uncommitted');
      ready.release();
      await resume.promise;
    });
    try {
      await waitUntilReady(ready, transaction);
      // Use the same database object outside the transaction's async scope.
      expect(await new PostgresSessionStore(first).get('uncommitted')).toBeNull();
      await second.query("INSERT INTO identity.users VALUES ('other', 'other@example.com', 'fixture', 1)");
    } finally { resume.release(); await transaction; }
    expect(await new PostgresSessionStore(second).get('uncommitted')).not.toBeNull();
    expect((await first.query("SELECT id FROM identity.users WHERE id = 'other'")).rows).toEqual([{ id: 'other' }]);
  });

  it('serializes competing refreshes and commits replay revocation', async () => {
    await session('race', 200);
    await session('independent', 200);
    const ready = gate();
    const resume = gate();
    const locking = first.withinTransaction(async () => {
      await first.query("SELECT id FROM identity.sessions WHERE id = 'race' FOR UPDATE");
      ready.release();
      await resume.promise;
    });
    let outcome!: Promise<PromiseSettledResult<unknown>[]>;
    try {
      await waitUntilReady(ready, locking);
      outcome = Promise.allSettled([
        new PostgresSessionStore(first).rotate('race-old', 'race-next-a', 100),
        new PostgresSessionStore(second).rotate('race-old', 'race-next-b', 100),
      ]);
      // Prove both queries reached the contested row before releasing its lock.
      let waiting = 0;
      const deadline = Date.now() + 2000;
      do {
        const result = await first.query<{ waiting: string }>(`SELECT count(*) AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE '%JOIN identity.refresh_tokens%'`);
        waiting = Number(result.rows[0].waiting);
        if (waiting < 2) await setTimeout(20);
      } while (waiting < 2 && Date.now() < deadline);
      expect(waiting).toBe(2);
    } finally { resume.release(); await locking; if (outcome) await outcome; }
    const results = await outcome;
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection?.status === 'rejected' && rejection.reason).toBeInstanceOf(RefreshTokenReuseError);
    expect((await new PostgresSessionStore(first).get('race'))?.revoked).toBe(true);
    expect((await new PostgresSessionStore(second).get('independent'))?.revoked).toBe(false);
    expect((await first.query("SELECT digest FROM identity.refresh_tokens WHERE session_id = 'race'")).rows).toHaveLength(2);
  });

  it('skips a locked expired family and removes it after the lock is released', async () => {
    await session('locked', 99);
    await session('available', 100);
    await session('live', 101);
    const ready = gate();
    const resume = gate();
    const locking = first.withinTransaction(async () => {
      await first.query("SELECT id FROM identity.sessions WHERE id = 'locked' FOR UPDATE");
      ready.release();
      await resume.promise;
    });
    try {
      await waitUntilReady(ready, locking);
      expect(await new PostgresSessionStore(second).pruneExpired(100, 1)).toBe(1);
      expect(await new PostgresSessionStore(second).get('available')).toBeNull();
      expect(await new PostgresSessionStore(second).pruneExpired(100, 1)).toBe(0);
      expect(await new PostgresSessionStore(second).get('locked')).not.toBeNull();
    } finally { resume.release(); await locking; }
    expect(await new PostgresSessionStore(second).pruneExpired(100, 1)).toBe(1);
    expect((await second.query('SELECT digest FROM identity.refresh_tokens ORDER BY digest')).rows).toEqual([{ digest: 'live-old' }]);
  });

  it('lets independent cleanup transactions remove disjoint batches', async () => {
    await session('oldest', 99);
    await session('next', 100);
    const ready = gate();
    const resume = gate();
    const transaction = first.withinTransaction(async () => {
      const removed = await new PostgresSessionStore(first).pruneExpired(100, 1);
      ready.release();
      await resume.promise;
      return removed;
    });
    try {
      await waitUntilReady(ready, transaction);
      expect(await new PostgresSessionStore(second).pruneExpired(100, 1)).toBe(1);
      expect(await new PostgresSessionStore(second).get('next')).toBeNull();
    } finally { resume.release(); expect(await transaction).toBe(1); }
    expect((await second.query('SELECT * FROM identity.sessions')).rows).toEqual([]);
    expect((await second.query('SELECT * FROM identity.refresh_tokens')).rows).toEqual([]);
  });

  async function publish() {
    await new PostgresOutboxEventBus(first).publish({ type: 'identity.user.registered.v1', occurredAt: new Date().toISOString(), data: { userId: 'user-1' } });
  }

  it('reads a typed pending summary in a PostgreSQL read-only transaction', async () => {
    await publish();
    const status = await second.withinTransaction(async () => {
      await second.query('SET TRANSACTION READ ONLY');
      return new PostgresOutboxStatusReader(second).read();
    });
    expect(status).toEqual({ pending: 1, ready: 1, leased: 0, deferred: 0, delivered: 0,
      attemptedPending: 0, oldestPendingAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/) });
  });

  it('claims different outbox events while another worker is still delivering', async () => {
    await publish();
    await publish();
    const ready = gate();
    const resume = gate();
    const ids: string[] = [];
    const worker = new PostgresOutboxDispatcher(first, { publish: async (event) => {
      ids.push(event.id!); ready.release(); await resume.promise;
    } }).drain(1);
    try {
      await waitUntilReady(ready, worker);
      expect(await new PostgresOutboxStatusReader(second).read()).toMatchObject({ pending: 2, ready: 1, leased: 1, deferred: 0, delivered: 0 });
      expect(await new PostgresOutboxDispatcher(second, { publish: async (event) => { ids.push(event.id!); } }).drain(1))
        .toEqual({ delivered: 1, failed: 0 });
      expect(new Set(ids).size).toBe(2);
      expect(await new PostgresOutboxStatusReader(second).read()).toMatchObject({ pending: 1, ready: 0, leased: 1, delivered: 1 });
    } finally { resume.release(); expect(await worker).toEqual({ delivered: 1, failed: 0 }); }
    expect((await second.query('SELECT attempts FROM identity.outbox WHERE delivered_at IS NOT NULL')).rows)
      .toEqual([{ attempts: 1 }, { attempts: 1 }]);
  });

  it('rejects a stale acknowledgement after another worker reclaims an expired lease', async () => {
    await publish();
    const ready = gate();
    const resume = gate();
    const ids: string[] = [];
    const worker = new PostgresOutboxDispatcher(first, { publish: async (event) => {
      ids.push(event.id!); ready.release(); await resume.promise;
    } }).drain(1);
    try {
      await waitUntilReady(ready, worker);
      await second.query("UPDATE identity.outbox SET claimed_until = now() - interval '1 second'");
      expect(await new PostgresOutboxDispatcher(second, { publish: async (event) => { ids.push(event.id!); } }).drain(1))
        .toEqual({ delivered: 1, failed: 0 });
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    } finally { resume.release(); expect(await worker).toEqual({ delivered: 0, failed: 1 }); }
    expect((await second.query('SELECT attempts, claim_id, last_error FROM identity.outbox WHERE delivered_at IS NOT NULL')).rows)
      .toEqual([{ attempts: 2, claim_id: null, last_error: null }]);
  });
});
