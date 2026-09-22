import { describe, expect, it } from 'vitest';
import {
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../../../../../kernel/container.js';
import { createSubscribingEventBus } from '../../../../../kernel/event-router.js';
import { RegisterUserCommand } from './command.js';
import { RegisterUserHandler } from './handler.js';
import { registerUserInput } from './validator.js';
import { ensureCanCreateUser } from './policy.js';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user-repository.js';
import { Permissions } from '../../../public/permissions.js';
import { InMemoryPolicyEvaluator } from '../../../../access/infrastructure/in-memory-policy-evaluator.js';
import { InMemoryAuditLogger } from '../../../../audit/infrastructure/in-memory-audit-logger.js';
import { createAuditSubscriber } from '../../../../audit/application/on-user-registered.js';
import { InMemoryNotificationSender } from '../../../../notification/infrastructure/in-memory-notification-sender.js';
import { createWelcomeEmailSubscriber } from '../../../../notification/application/on-user-registered.js';

describe('RegisterUserHandler', () => {
  it('registers a user and publishes a domain event', async () => {
    const users = new InMemoryUserRepository();
    const log: string[] = [];
    const events = createInMemoryEventBus(log);
    const handler = new RegisterUserHandler(users, events, createImmediateTransactionManager());

    const result = await handler.execute(
      new RegisterUserCommand('User@Example.com', 'password-hash', 'user-1'),
    );

    expect(result).toEqual({ userId: 'user-1', email: 'user@example.com' });
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('identity.user.registered.v1');
  });

  it('rejects invalid email input at the boundary', () => {
    const parsed = registerUserInput.safeParse({
      email: 'not-an-email',
      passwordHash: 'password-hash',
    });
    expect(parsed.success).toBe(false);
  });

  it('enforces optimistic concurrency on save', async () => {
    const users = new InMemoryUserRepository();
    const handler = new RegisterUserHandler(
      users,
      createInMemoryEventBus(),
      createImmediateTransactionManager(),
    );
    await handler.execute(new RegisterUserCommand('a@example.com', 'password-hash', 'user-1'));

    await expect(users.save(await users.get('user-1'), 0)).rejects.toThrow('Concurrency conflict');
  });

  it('records audit and sends welcome notification through subscribers', async () => {
    const users = new InMemoryUserRepository();
    const audit = new InMemoryAuditLogger();
    const notifications = new InMemoryNotificationSender();
    const events = createSubscribingEventBus(createInMemoryEventBus(), [
      createAuditSubscriber(audit),
      createWelcomeEmailSubscriber(notifications),
    ]);
    const handler = new RegisterUserHandler(users, events, createImmediateTransactionManager());

    await handler.execute(new RegisterUserCommand('b@example.com', 'password-hash', 'user-2'));

    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe('identity.user.registered');
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]).toMatchObject({ channel: 'email', to: 'b@example.com' });
  });
});

describe('access policy', () => {
  it('allows only roles that hold the permission', async () => {
    const policy = new InMemoryPolicyEvaluator([
      { role: 'admin', permissions: [Permissions.UserCreate] },
      { role: 'user', permissions: [Permissions.UserRead] },
    ]);

    await expect(ensureCanCreateUser(policy, { id: '1', roles: ['admin'] })).resolves.toBeUndefined();
    await expect(ensureCanCreateUser(policy, { id: '2', roles: ['user'] })).rejects.toThrow(
      'Forbidden',
    );
  });
});
