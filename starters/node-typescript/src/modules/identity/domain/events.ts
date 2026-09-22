import type { DomainEvent } from '../../../kernel/ports.js';

export function userRegistered(userId: string, email: string): DomainEvent {
  return {
    type: 'identity.user.registered.v1',
    occurredAt: new Date().toISOString(),
    data: { userId, email },
  };
}

export function loginSucceeded(userId: string, email: string): DomainEvent {
  return {
    type: 'identity.user.login_succeeded.v1',
    occurredAt: new Date().toISOString(),
    data: { userId, email },
  };
}

export function loginFailed(email: string): DomainEvent {
  return {
    type: 'identity.user.login_failed.v1',
    occurredAt: new Date().toISOString(),
    data: { email },
  };
}
