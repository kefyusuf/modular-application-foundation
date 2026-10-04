import type { EventContext } from '../../../kernel/ports.js';

export interface AuditEntry {
  context?: EventContext;
  action: string;
  actorId: string;
  subject: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface AuditLogger {
  record(entry: AuditEntry, idempotencyKey?: string): Promise<void>;
}
