import type { TransactionManager } from './ports.js';

export interface SqlResult<Row> { rows: Row[]; rowCount: number }

export interface SqlDatabase extends TransactionManager {
  query<Row extends object = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<SqlResult<Row>>;
  close(): Promise<void>;
}
