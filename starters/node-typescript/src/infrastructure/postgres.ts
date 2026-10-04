import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import type { SqlDatabase, SqlResult } from '../kernel/sql.js';

export class PostgresDatabase implements SqlDatabase {
  private readonly pool: Pool;
  private readonly context = new AsyncLocalStorage<PoolClient>();

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    // pg has already evicted this idle client before emitting the pool error.
    // Handle the event without exposing connection details or replaying work.
    this.pool.on('error', () => { console.error('Idle PostgreSQL connection failed; removed from pool'); });
  }

  async query<Row extends object>(sql: string, values: unknown[] = []): Promise<SqlResult<Row>> {
    const connection = this.context.getStore() ?? this.pool;
    const result = await connection.query<Row>(sql, values);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  async withinTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    const client = await this.pool.connect();
    let discard = false;
    let connectionError: Error | undefined;
    const onConnectionError = (error: Error) => {
      discard = true;
      if (connectionError) return;
      connectionError = error;
      console.error('PostgreSQL transaction connection failed; transaction cannot continue');
    };
    // Checked-out clients no longer have the pool's idle error listener.
    client.on('error', onConnectionError);
    try {
      await client.query('BEGIN');
      const result = await this.context.run(client, fn);
      if (connectionError) throw connectionError;
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally {
      try { client.release(discard); }
      finally { client.removeListener('error', onConnectionError); }
    }
  }

  async close(): Promise<void> { await this.pool.end(); }
}
