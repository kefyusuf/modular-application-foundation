import type { AuditEntry, AuditLogger } from '../public/audit-logger.js';

export class InMemoryAuditLogger implements AuditLogger {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
