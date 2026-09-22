import type { DomainEvent } from '../../../kernel/ports.js';
import type { AuditLogger } from '../public/audit-logger.js';

export function createAuditSubscriber(audit: AuditLogger) {
  return async function onDomainEvent(event: DomainEvent): Promise<void> {
    if (event.type !== 'identity.user.registered.v1') {
      return;
    }
    await audit.record({
      action: 'identity.user.registered',
      actorId: String(event.data.userId ?? 'system'),
      subject: String(event.data.userId ?? ''),
      occurredAt: event.occurredAt,
      data: { email: event.data.email },
    });
  };
}
