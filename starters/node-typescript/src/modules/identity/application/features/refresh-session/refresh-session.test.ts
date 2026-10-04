import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../../../../kernel/ports.js';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user-repository.js';
import { JwtTokenService } from '../../../infrastructure/auth/jwt-token-service.js';
import { RefreshSessionCommand } from './command.js';
import { RefreshSessionHandler } from './handler.js';

describe('refresh session identity validation', () => {
  it('revokes the refreshed family if the identity no longer exists and records a reason', async () => {
    const users = new InMemoryUserRepository();
    const tokens = new JwtTokenService();
    const original = await tokens.issue('deleted-user');
    const events: DomainEvent[] = [];
    const handler = new RefreshSessionHandler(users, tokens, { publish: async (event) => { events.push(event); } });
    await expect(handler.execute(new RefreshSessionCommand(original.refresh_token))).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(original.access_token)).rejects.toThrow('Invalid credentials');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'identity.session.revoked.v1', data: { userId: 'deleted-user', reason: 'missing_identity' } });
    expect(JSON.stringify(events)).not.toContain(original.refresh_token);
  });
});
