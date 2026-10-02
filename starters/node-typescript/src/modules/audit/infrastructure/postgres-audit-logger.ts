import type { SqlDatabase } from '../../../kernel/sql.js';
import type { AuditEntry, AuditLogger } from '../public/audit-logger.js';

export class PostgresAuditLogger implements AuditLogger {
  constructor(private readonly database: SqlDatabase) {}

  async record(entry: AuditEntry, idempotencyKey?: string): Promise<void> {
    // The unique delivery receipt and audit effect are the same atomic row.
    await this.database.query('INSERT INTO audit.entries (event_id, entry) VALUES ($1, $2::jsonb) ON CONFLICT (event_id) DO NOTHING', [idempotencyKey ?? null, JSON.stringify(entry)]);
  }

  async list(): Promise<AuditEntry[]> {
    const { rows } = await this.database.query<{ entry: AuditEntry }>('SELECT entry FROM audit.entries ORDER BY id');
    return rows.map((row) => row.entry);
  }
}
