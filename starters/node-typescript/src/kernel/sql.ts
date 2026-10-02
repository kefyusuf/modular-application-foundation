import type { TransactionManager } from './ports.js';

export interface SqlResult<Row> { rows: Row[]; rowCount: number }

export interface SqlMigration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export interface SqlDatabase extends TransactionManager {
  query<Row extends object = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<SqlResult<Row>>;
  close(): Promise<void>;
}
