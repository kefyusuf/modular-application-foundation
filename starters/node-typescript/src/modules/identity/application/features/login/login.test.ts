import { describe, expect, it } from 'vitest';
import {
  createInMemoryEventBus,
  createImmediateTransactionManager,
} from '../../../../../kernel/container.js';
import { RegisterUserCommand } from '../register-user/command.js';
import { RegisterUserHandler } from '../register-user/handler.js';
import { LoginCommand } from './command.js';
import { LoginHandler } from './handler.js';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user-repository.js';
import { InMemorySettingStore } from '../../../../settings/infrastructure/in-memory-setting-store.js';

describe('LoginHandler', () => {
  it('issues a token and publishes login_succeeded', async () => {
    const users = new InMemoryUserRepository();
    const log: string[] = [];
    const events = createInMemoryEventBus(log);
    const settings = new InMemorySettingStore();
    await settings.set('security.max_login_attempts', 5);
    const tx = createImmediateTransactionManager();

    await new RegisterUserHandler(users, events, tx).execute(
      new RegisterUserCommand('user@example.com', 'password-hash', 'user-1'),
    );

    const result = await new LoginHandler(users, events, tx, settings).execute(
      new LoginCommand('user@example.com', 'password-hash'),
    );

    expect(result.userId).toBe('user-1');
    expect(result.token).toBe('token.user-1');
    expect(log.some((line) => line.includes('identity.user.login_succeeded.v1'))).toBe(true);
  });

  it('rejects bad credentials and publishes login_failed', async () => {
    const users = new InMemoryUserRepository();
    const log: string[] = [];
    const events = createInMemoryEventBus(log);
    const settings = new InMemorySettingStore();
    await settings.set('security.max_login_attempts', 5);
    const tx = createImmediateTransactionManager();

    await new RegisterUserHandler(users, events, tx).execute(
      new RegisterUserCommand('user@example.com', 'password-hash', 'user-1'),
    );

    await expect(
      new LoginHandler(users, events, tx, settings).execute(
        new LoginCommand('user@example.com', 'wrong-hash'),
      ),
    ).rejects.toThrow('Invalid credentials');
    expect(log.some((line) => line.includes('identity.user.login_failed.v1'))).toBe(true);
  });

  it('locks out after max_login_attempts from settings', async () => {
    const users = new InMemoryUserRepository();
    const events = createInMemoryEventBus();
    const settings = new InMemorySettingStore();
    await settings.set('security.max_login_attempts', 2);
    const tx = createImmediateTransactionManager();
    const handler = new LoginHandler(users, events, tx, settings);

    await expect(
      handler.execute(new LoginCommand('user@example.com', 'wrong-hash')),
    ).rejects.toThrow('Invalid credentials');
    await expect(
      handler.execute(new LoginCommand('user@example.com', 'wrong-hash')),
    ).rejects.toThrow('Invalid credentials');
    await expect(
      handler.execute(new LoginCommand('user@example.com', 'password-hash')),
    ).rejects.toThrow('Too many attempts');
  });
});
