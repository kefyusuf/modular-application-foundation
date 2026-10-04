import type { DomainEvent } from '../../../kernel/ports.js';
import type { AuditLogger } from '../public/audit-logger.js';

export function createAuditSubscriber(audit: AuditLogger) {
  return async function onDomainEvent(event: DomainEvent): Promise<void> {
    if (event.type === 'identity.session.revoked.v1') {
      await audit.record({
        ...(event.context ? { context: event.context } : {}),
        action: 'identity.session.revoked', actorId: String(event.data.userId),
        subject: String(event.data.sessionId), occurredAt: event.occurredAt,
        data: { userId: event.data.userId, reason: event.data.reason },
      }, event.id);
      return;
    }
    if (event.type !== 'identity.user.registered.v1') {
      return;
    }
    await audit.record({
      ...(event.context ? { context: event.context } : {}),
      action: 'identity.user.registered',
      actorId: String(event.data.userId ?? 'system'),
      subject: String(event.data.userId ?? ''),
      occurredAt: event.occurredAt,
      data: { email: event.data.email },
    }, event.id);
  };
}
