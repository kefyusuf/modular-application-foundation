import type { CommandHandler, EventBus, TransactionManager } from '../../../../../kernel/ports.js';
import type { SessionTokenService } from '../../../public/auth-contracts.js';
import { sessionRevoked } from '../../../domain/events.js';
import type { LogoutCommand } from './command.js';

export class LogoutHandler implements CommandHandler<LogoutCommand, void> {
  constructor(private readonly tokens: SessionTokenService, private readonly events: EventBus, private readonly tx: TransactionManager = { withinTransaction: (fn) => fn() }) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.tx.withinTransaction(async () => {
      const session = await this.tokens.revoke(command.accessToken);
      await this.events.publish(sessionRevoked(session.userId, session.sessionId));
    });
  }
}
