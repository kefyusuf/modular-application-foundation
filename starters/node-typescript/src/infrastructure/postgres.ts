import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import type { SqlDatabase, SqlResult } from '../kernel/sql.js';

export class PostgresDatabase implements SqlDatabase {
  private readonly pool: Pool;
  private readonly context = new AsyncLocalStorage<PoolClient>();

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
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
    try {
      await client.query('BEGIN');
      const result = await this.context.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async close(): Promise<void> { await this.pool.end(); }
}
