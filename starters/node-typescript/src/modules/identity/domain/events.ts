import type { DomainEvent } from '../../../kernel/ports.js';

export function userRegistered(userId: string, email: string): DomainEvent {
  return {
    type: 'identity.user.registered.v1',
    occurredAt: new Date().toISOString(),
    data: { userId, email },
  };
}
