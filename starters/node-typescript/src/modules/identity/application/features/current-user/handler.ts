import type { CommandHandler, PolicyEvaluator } from '../../../../../kernel/ports.js';
import type { TokenService } from '../../../public/auth-contracts.js';
import { Permissions } from '../../../public/permissions.js';
import type { UserRepository } from '../../ports.js';
import type { CurrentUserCommand } from './command.js';

export interface CurrentUserResult { id: string; email: string; permissions: string[] }

export class CurrentUserHandler implements CommandHandler<CurrentUserCommand, CurrentUserResult> {
  constructor(private readonly users: UserRepository, private readonly tokens: TokenService, private readonly policy: PolicyEvaluator) {}

  async execute(command: CurrentUserCommand): Promise<CurrentUserResult> {
    const actor = await this.tokens.verify(command.accessToken);
    let user;
    try { user = await this.users.get(actor.id); } catch { throw new Error('Invalid credentials'); }
    if (!await this.policy.can(actor, Permissions.UserRead, { userId: user.id })) throw new Error('Forbidden');
    const permissions: string[] = [];
    for (const permission of Object.values(Permissions)) {
      if (await this.policy.can(actor, permission, { userId: user.id })) permissions.push(permission);
    }
    return { id: user.id, email: user.email.value, permissions };
  }
}
