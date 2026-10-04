import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setTimeout } from 'node:timers/promises';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgresDatabase } from './postgres.js';
import { runMigrations } from './migrations.js';
import { identityMigrations } from '../modules/identity/infrastructure/persistence/schema.js';
import { PostgresSessionStore } from '../modules/identity/infrastructure/auth/postgres-session-store.js';
import { RefreshTokenReuseError } from '../modules/identity/public/auth-contracts.js';
import { PostgresOutboxDispatcher, PostgresOutboxEventBus } from '../modules/identity/infrastructure/persistence/postgres-outbox.js';
import { PostgresOutboxStatusReader } from '../modules/identity/infrastructure/persistence/postgres-outbox-status.js';
import { auditMigrations } from '../modules/audit/infrastructure/schema.js';
import { notificationMigrations } from '../modules/notification/infrastructure/schema.js';

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
    await runMigrations(first, 'audit', auditMigrations);
    await runMigrations(first, 'notification', notificationMigrations);
  }, 15000);

  beforeEach(async () => {
    await first.query('TRUNCATE identity.refresh_tokens, identity.sessions, identity.outbox, identity.users, audit.entries, notification.messages');
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
    await new PostgresOutboxEventBus(first).publish({ type: 'identity.user.registered.v1', occurredAt: new Date().toISOString(), data: { userId: 'user-1', email: 'user@example.com' } });
  }

  async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer!: ReturnType<typeof globalThis.setTimeout>;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => reject(new Error(`Worker ${label} timed out`)), 4000);
      })]);
    } finally { globalThis.clearTimeout(timer); }
  }

  type WorkerMessage = { phase: string; pid?: number; users?: number; args?: unknown[]; rejected?: boolean;
    code?: string; invocations?: number; result?: { delivered: number; failed: number } };

  function worker(mode: string, entry = 'postgres-consumer-worker.mjs') {
    const child = fork(fileURLToPath(new URL(`../../scripts/${entry}`, import.meta.url)), [mode], {
      execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { ...process.env, DATABASE_URL: '', FOUNDATION_POSTGRES_TEST_URL: connectionString! },
    });
    let stderr = '';
    child.stderr?.on('data', (data) => { stderr = (stderr + String(data)).slice(-2000); });
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
      child.once('error', () => resolve({ code: 1, signal: null }));
    });
    const message = new Promise<WorkerMessage>((resolve, reject) => {
      child.once('message', (value) => resolve(value as WorkerMessage));
      child.once('error', reject);
      child.once('exit', () => reject(new Error(`Worker exited before checkpoint: ${stderr}`)));
    });
    return { child, exited, message };
  }

  function nextWorkerMessage(running: ReturnType<typeof worker>) {
    const response = Promise.race([
      new Promise<WorkerMessage>((resolve) => running.child.once('message', (value) => resolve(value as WorkerMessage))),
      running.exited.then(() => { throw new Error('Worker exited before its next message'); }),
    ]);
    // A preceding SQL assertion can fail before this promise is awaited.
    void response.catch(() => {});
    return response;
  }

  it('survives idle backend termination with a sanitized notice and a fresh connection', async () => {
    const running = worker('idle', 'postgres-connection-worker.mjs');
    try {
      const initial = await bounded(running.message, 'idle connection');
      expect(initial).toMatchObject({ phase: 'idle', users: 1 });
      expect(typeof initial.pid).toBe('number');
      const notice = nextWorkerMessage(running);
      expect((await second.query<{ terminated: boolean }>('SELECT pg_terminate_backend($1) AS terminated', [initial.pid])).rows)
        .toEqual([{ terminated: true }]);
      expect(await bounded(notice, 'idle error notice')).toEqual({ phase: 'idle-error',
        args: ['Idle PostgreSQL connection failed; removed from pool'] });
      const recovery = nextWorkerMessage(running);
      running.child.send('probe');
      const restored = await bounded(recovery, 'new connection');
      expect(restored).toMatchObject({ phase: 'recovered', users: 1 });
      expect(typeof restored.pid).toBe('number');
      expect(restored.pid).not.toBe(initial.pid);
      expect((await bounded(running.exited, 'connection worker exit')).code).toBe(0);
    } finally {
      void running.message.catch(() => {});
      if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill('SIGKILL');
      await bounded(running.exited, 'connection worker cleanup');
    }
  });

  it('rejects a lost transaction between queries without replay and commits a later transaction', async () => {
    const running = worker('transaction-gap', 'postgres-transaction-worker.mjs');
    try {
      const initial = await bounded(running.message, 'open transaction');
      expect(initial.phase).toBe('transaction-open');
      expect(typeof initial.pid).toBe('number');
      // Independent observers cannot see the producer's uncommitted writes.
      expect((await second.query("SELECT id FROM identity.users WHERE id = 'interrupted'")).rows).toEqual([]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
      const notice = nextWorkerMessage(running);
      expect((await second.query<{ terminated: boolean }>('SELECT pg_terminate_backend($1) AS terminated', [initial.pid])).rows)
        .toEqual([{ terminated: true }]);
      expect(await bounded(notice, 'transaction error notice')).toEqual({ phase: 'transaction-error',
        args: ['PostgreSQL transaction connection failed; transaction cannot continue'] });
      const rejection = nextWorkerMessage(running);
      running.child.send('resume');
      expect(await bounded(rejection, 'transaction rejection')).toEqual({ phase: 'rejected', rejected: true, code: '57P01', invocations: 1 });
      expect((await second.query("SELECT id FROM identity.users WHERE id = 'interrupted'")).rows).toEqual([]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
      const recovery = nextWorkerMessage(running);
      running.child.send('recover');
      const restored = await bounded(recovery, 'later transaction');
      expect(restored).toMatchObject({ phase: 'recovered', invocations: 1 });
      expect(typeof restored.pid).toBe('number');
      expect(restored.pid).not.toBe(initial.pid);
      expect((await bounded(running.exited, 'transaction worker exit')).code).toBe(0);
      expect((await second.query("SELECT id FROM identity.users WHERE id IN ('interrupted', 'recovered') ORDER BY id")).rows)
        .toEqual([{ id: 'recovered' }]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
    } finally {
      void running.message.catch(() => {});
      if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill('SIGKILL');
      await bounded(running.exited, 'transaction worker cleanup');
    }
  });

  it.each([
    { action: 'terminate', code: '57P01', replace: true },
    { action: 'cancel', code: '57014', replace: false },
  ])('handles $action of an executing SQL statement without replay and commits a later transaction', async ({ action, code, replace }) => {
    const running = worker('transaction-query', 'postgres-transaction-worker.mjs');
    try {
      const initial = await bounded(running.message, 'query transaction');
      expect(initial.phase).toBe('transaction-open');
      expect(typeof initial.pid).toBe('number');
      // Observe server-side execution rather than assuming the worker has sent its query.
      const deadline = Date.now() + 2000;
      let executing = false;
      do {
        const activity = await second.query<{ executing: boolean }>(`SELECT
          state = 'active' AND wait_event = 'PgSleep' AND query LIKE '%foundation_inflight%' AS executing
          FROM pg_stat_activity WHERE pid = $1 AND datname = current_database()`, [initial.pid]);
        executing = activity.rows[0]?.executing === true;
        if (!executing) await setTimeout(20);
      } while (!executing && Date.now() < deadline);
      expect(executing).toBe(true);
      expect((await second.query("SELECT id FROM identity.users WHERE id = 'interrupted'")).rows).toEqual([]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
      const rejection = nextWorkerMessage(running);
      const sql = action === 'terminate' ? 'SELECT pg_terminate_backend($1) AS signalled' : 'SELECT pg_cancel_backend($1) AS signalled';
      expect((await second.query<{ signalled: boolean }>(sql, [initial.pid])).rows).toEqual([{ signalled: true }]);
      expect(await bounded(rejection, 'executing query rejection')).toEqual({ phase: 'rejected', rejected: true, code, invocations: 1 });
      expect((await second.query("SELECT id FROM identity.users WHERE id = 'interrupted'")).rows).toEqual([]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
      const recovery = nextWorkerMessage(running);
      running.child.send('recover');
      const restored = await bounded(recovery, 'post-query recovery');
      expect(restored).toMatchObject({ phase: 'recovered', invocations: 1 });
      expect(typeof restored.pid).toBe('number');
      if (replace) expect(restored.pid).not.toBe(initial.pid);
      else expect(restored.pid).toBe(initial.pid);
      expect((await bounded(running.exited, 'query worker exit')).code).toBe(0);
      expect((await second.query("SELECT id FROM identity.users WHERE id IN ('interrupted', 'recovered') ORDER BY id")).rows)
        .toEqual([{ id: 'recovered' }]);
      expect((await second.query('SELECT id FROM identity.outbox')).rows).toEqual([]);
    } finally {
      void running.message.catch(() => {});
      if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill('SIGKILL');
      await bounded(running.exited, 'executing query cleanup');
    }
  });

  it.each(['after-audit', 'after-effects'])('recovers from a killed consumer process %s without repeating durable effects', async (phase) => {
    await publish();
    const crashed = worker(phase);
    let recovered: ReturnType<typeof worker> | undefined;
    try {
      expect(await bounded(crashed.message, 'checkpoint')).toEqual({ phase });
      const auditBefore = (await second.query('SELECT event_id, entry FROM audit.entries')).rows;
      expect(auditBefore).toHaveLength(1);
      const notificationBefore = (await second.query('SELECT event_id, message, status FROM notification.messages')).rows;
      expect(notificationBefore).toHaveLength(phase === 'after-audit' ? 0 : 1);
      expect(crashed.child.kill('SIGKILL')).toBe(true);
      expect((await bounded(crashed.exited, 'forced exit')).code).not.toBe(0);
      expect(await new PostgresOutboxStatusReader(second).read()).toMatchObject({ pending: 1, leased: 1, delivered: 0 });
      expect(await new PostgresOutboxDispatcher(second, { publish: async () => { throw new Error('Active lease must not be delivered'); } }).drain(1))
        .toEqual({ delivered: 0, failed: 0 });
      // Advance only this fixture's lease instead of waiting the full 30 seconds.
      await second.query("UPDATE identity.outbox SET claimed_until = now() - interval '1 second'");
      recovered = worker('complete');
      expect(await bounded(recovered.message, 'recovery')).toEqual({ phase: 'complete', result: { delivered: 1, failed: 0 } });
      expect((await bounded(recovered.exited, 'recovery exit')).code).toBe(0);
      expect((await second.query('SELECT event_id, entry FROM audit.entries')).rows).toEqual(auditBefore);
      const notification = (await second.query('SELECT event_id, message, status FROM notification.messages')).rows;
      const outbox = (await second.query('SELECT id, attempts, claim_id FROM identity.outbox WHERE delivered_at IS NOT NULL')).rows;
      expect(outbox).toEqual([{ id: (auditBefore[0] as { event_id: string }).event_id, attempts: 2, claim_id: null }]);
      expect(notification).toEqual([{ event_id: (outbox[0] as { id: string }).id, status: 'pending',
        message: { channel: 'email', to: 'user@example.com', subject: 'Welcome', body: 'Your account was created.' } }]);
      if (phase === 'after-effects') expect(notification).toEqual(notificationBefore);
    } finally {
      for (const running of [crashed, recovered]) {
        if (!running) continue;
        // Attach a rejection handler even if an earlier assertion prevented checkpoint consumption.
        void running.message.catch(() => {});
        if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill('SIGKILL');
        await bounded(running.exited, 'cleanup');
      }
    }
  });

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
