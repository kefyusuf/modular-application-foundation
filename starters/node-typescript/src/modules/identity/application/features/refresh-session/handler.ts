import type { CommandHandler, EventBus, TransactionManager } from '../../../../../kernel/ports.js';
import type { AuthTokens, SessionTokenService } from '../../../public/auth-contracts.js';
import type { UserRepository } from '../../ports.js';
import type { RefreshSessionCommand } from './command.js';
import { RefreshTokenReuseError } from '../../../public/auth-contracts.js';
import { sessionRevoked } from '../../../domain/events.js';

export class RefreshSessionHandler implements CommandHandler<RefreshSessionCommand, AuthTokens> {
  constructor(private readonly users: UserRepository, private readonly tokens: SessionTokenService, private readonly events: EventBus, private readonly tx: TransactionManager = { withinTransaction: (fn) => fn() }) {}

  async execute(command: RefreshSessionCommand): Promise<AuthTokens> {
    const outcome = await this.tx.withinTransaction(async (): Promise<{ tokens: AuthTokens } | { error: Error }> => {
      let result: AuthTokens;
      try { result = await this.tokens.refresh(command.refreshToken); } catch (error) {
        if (error instanceof RefreshTokenReuseError) {
          await this.events.publish(sessionRevoked(error.userId, error.sessionId, 'refresh_token_reuse'));
          return { error };
        }
        throw error;
      }
      const actor = await this.tokens.verify(result.access_token);
      try { await this.users.get(actor.id); } catch {
        const session = await this.tokens.revoke(result.access_token);
        await this.events.publish(sessionRevoked(session.userId, session.sessionId, 'missing_identity'));
        return { error: new Error('Invalid credentials') };
      }
      return { tokens: result };
    });
    // Replay/missing-identity revocations and their outbox events commit before rejection.
    if ('error' in outcome) throw outcome.error;
    return outcome.tokens;
  }
}
