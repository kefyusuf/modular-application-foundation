import type { Actor, PolicyEvaluator } from '../../../kernel/ports.js';
import type { RolePermissions } from '../public/contracts.js';

export class InMemoryPolicyEvaluator implements PolicyEvaluator {
  constructor(private readonly roles: RolePermissions[]) {}

  async can(actor: Actor, action: string): Promise<boolean> {
    return actor.roles.some((role) =>
      this.roles.find((entry) => entry.role === role)?.permissions.includes(action),
    );
  }
}
