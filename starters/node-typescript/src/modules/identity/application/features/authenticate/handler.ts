import type { CommandHandler } from '../../../../../kernel/ports.js';
import type { AuthTokens, TokenService } from '../../../public/auth-contracts.js';
import { LoginCommand } from '../login/command.js';
import type { LoginHandler } from '../login/handler.js';
import type { AuthenticateCommand } from './command.js';

export class AuthenticateHandler implements CommandHandler<AuthenticateCommand, AuthTokens> {
  constructor(private readonly login: LoginHandler, private readonly tokens: TokenService) {}

  async execute(command: AuthenticateCommand): Promise<AuthTokens> {
    const user = await this.login.execute(new LoginCommand(command.email, command.password, 'password'));
    return this.tokens.issue(user.userId);
  }
}
