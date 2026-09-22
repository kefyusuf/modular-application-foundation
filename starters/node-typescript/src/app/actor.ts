import type { IncomingMessage } from 'node:http';
import type { Actor } from '../kernel/ports.js';

export function actorFromRequest(req: IncomingMessage): Actor {
  const actorId = req.headers['x-actor-id'];
  const rolesHeader = req.headers['x-actor-roles'];
  return {
    id: typeof actorId === 'string' ? actorId : 'anonymous',
    roles: typeof rolesHeader === 'string' ? rolesHeader.split(',').map((r) => r.trim()) : [],
  };
}
