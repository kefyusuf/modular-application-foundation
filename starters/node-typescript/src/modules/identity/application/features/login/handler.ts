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
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    return this.tx.withinTransaction(async () => {
      const email = Email.from(command.email).value;
      const maxAttempts = await this.settings.getNumber('security.max_login_attempts', 5);
      const attempts = this.failedAttempts.get(email) ?? 0;
      if (attempts >= maxAttempts) {
        await this.events.publish(loginFailed(email));
        throw new Error('Too many attempts');
      }

      const user = await this.users.findByEmail(email);
      if (!user || !user.verifyPassword(command.passwordHash)) {
        this.failedAttempts.set(email, attempts + 1);
        await this.events.publish(loginFailed(email));
        throw new Error('Invalid credentials');
      }

      this.failedAttempts.delete(email);
      await this.events.publish(loginSucceeded(user.id, user.email.value));
      return {
        userId: user.id,
        email: user.email.value,
        token: `token.${user.id}`,
      };
    });
  }
}
