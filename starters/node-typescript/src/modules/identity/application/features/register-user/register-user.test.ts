import { describe, expect, it } from 'vitest';
import {
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../../../../../kernel/container.js';
import { RegisterUserCommand } from './command.js';
import { RegisterUserHandler } from './handler.js';
import { registerUserInput } from './validator.js';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user-repository.js';

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
});
