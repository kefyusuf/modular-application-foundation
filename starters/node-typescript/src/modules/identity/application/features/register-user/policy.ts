import type { Actor, PolicyEvaluator } from '../../../../../kernel/ports.js';
import { Permissions } from '../../../public/permissions.js';

export async function ensureCanCreateUser(policy: PolicyEvaluator, actor: Actor): Promise<void> {
  const allowed = await policy.can(actor, Permissions.UserCreate);
  if (!allowed) {
    throw new Error('Forbidden');
  }
}
