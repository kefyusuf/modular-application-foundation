import type { AuditEntry, AuditLogger } from '../public/audit-logger.js';

export class InMemoryAuditLogger implements AuditLogger {
  readonly entries: AuditEntry[] = [];
  private readonly recorded = new Set<string>();

  async list(): Promise<AuditEntry[]> { return [...this.entries]; }

  async record(entry: AuditEntry, idempotencyKey?: string): Promise<void> {
    if (idempotencyKey && this.recorded.has(idempotencyKey)) return;
    this.entries.push(entry);
    if (idempotencyKey) this.recorded.add(idempotencyKey);
  }
}
