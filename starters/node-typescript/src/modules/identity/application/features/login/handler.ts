import type {
  CommandHandler,
  EventBus,
  TransactionManager,
} from '../../../../../kernel/ports.js';
import type { SettingReader } from '../../../../settings/public/setting-contracts.js';
import { Email } from '../../../domain/email.js';
import { loginFailed, loginSucceeded } from '../../../domain/events.js';
import type { UserRepository } from '../../ports.js';
import type { LoginCommand } from './command.js';
import type { PasswordHasher } from '../../../public/auth-contracts.js';

export interface LoginResult {
  userId: string;
  email: string;
  token: string;
}

export class LoginHandler implements CommandHandler<LoginCommand, LoginResult> {
  private readonly failedAttempts = new Map<string, number>();

  constructor(
    private readonly users: UserRepository,
    private readonly events: EventBus,
    private readonly tx: TransactionManager,
    private readonly settings: SettingReader,
    private readonly passwords?: PasswordHasher,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const outcome = await this.tx.withinTransaction(async (): Promise<{ result: LoginResult } | { error: Error }> => {
      const email = Email.from(command.email).value;
      const maxAttempts = await this.settings.getNumber('security.max_login_attempts', 5);
      const attempts = this.failedAttempts.get(email) ?? 0;
      if (attempts >= maxAttempts) {
        await this.events.publish(loginFailed(email));
        return { error: new Error('Too many attempts') };
      }

      const user = await this.users.findByEmail(email);
      if (command.credentialKind === 'password' && !this.passwords) throw new Error('Password hasher not configured');
      const matches = user && (command.credentialKind === 'password'
        ? await this.passwords!.verify(command.passwordHash, user.getPasswordDigest())
        : !user.getPasswordDigest().startsWith('scrypt$') && user.verifyPassword(command.passwordHash));
      if (!matches) {
        this.failedAttempts.set(email, attempts + 1);
        await this.events.publish(loginFailed(email));
        return { error: new Error('Invalid credentials') };
      }

      if (!user) throw new Error('Invalid credentials');
      this.failedAttempts.delete(email);
      await this.events.publish(loginSucceeded(user.id, user.email.value));
      return { result: {
        userId: user.id,
        email: user.email.value,
        token: `token.${user.id}`,
      } };
    });
    // Expected authentication failures commit their audit/outbox event before rejection.
    if ('error' in outcome) throw outcome.error;
    return outcome.result;
  }
}
