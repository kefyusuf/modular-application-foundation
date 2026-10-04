import { describe, expect, it } from 'vitest';
import type { TokenService } from '../../../public/auth-contracts.js';
import { User } from '../../../domain/user.js';
import { Email } from '../../../domain/email.js';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user-repository.js';
import { CurrentUserHandler } from './handler.js';
import { CurrentUserCommand } from './command.js';

const tokens: TokenService = {
  issue: async () => { throw new Error('Not used in this fixture'); },
  verify: async () => ({ id: 'user-1', roles: ['user'] }),
};

describe('current user authorization', () => {
  it('rejects an authenticated identity without read permission', async () => {
    const users = new InMemoryUserRepository();
    await users.save(User.register('user-1', Email.from('user@example.com'), 'private-digest'), 0);
    const handler = new CurrentUserHandler(users, tokens, { can: async () => false });
    await expect(handler.execute(new CurrentUserCommand('fixture'))).rejects.toThrow('Forbidden');
  });

  it('rejects a token whose identity no longer exists', async () => {
    const handler = new CurrentUserHandler(new InMemoryUserRepository(), tokens, { can: async () => true });
    await expect(handler.execute(new CurrentUserCommand('fixture'))).rejects.toThrow('Invalid credentials');
  });
});
