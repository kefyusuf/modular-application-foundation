import type { CommandHandler, EventBus, TransactionManager } from '../../../../../kernel/ports.js';
import { Email } from '../../../domain/email.js';
import { User } from '../../../domain/user.js';
import type { UserRepository } from '../../ports.js';
import type { RegisterUserCommand } from './command.js';

export interface RegisterUserResult {
  userId: string;
  email: string;
}

export class RegisterUserHandler
  implements CommandHandler<RegisterUserCommand, RegisterUserResult>
{
  constructor(
    private readonly users: UserRepository,
    private readonly events: EventBus,
    private readonly tx: TransactionManager,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    return this.tx.withinTransaction(async () => {
      const user = User.register(command.userId, Email.from(command.email), command.passwordHash);
      await this.users.save(user, 0);
      for (const event of user.pullDomainEvents()) {
        await this.events.publish(event);
      }
      return { userId: user.id, email: user.email.value };
    });
  }
}
