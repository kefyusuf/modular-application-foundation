import { randomBytes } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';
import { JwtTokenService } from './jwt-token-service.js';
import { InMemorySessionStore } from './in-memory-session-store.js';

describe('session lifecycle', () => {
  it('prunes only expired sessions and removes their complete refresh history', async () => {
    const sessions = new InMemorySessionStore();
    await sessions.create({ id: 'expired', userId: 'user-1', refreshDigest: 'old-digest', expiresAt: 100, revoked: false });
    await sessions.rotate('old-digest', 'expired-current', 99);
    await sessions.create({ id: 'active', userId: 'user-1', refreshDigest: 'active-old', expiresAt: 101, revoked: false });
    await sessions.rotate('active-old', 'active-current', 99);
    await sessions.create({ id: 'revoked', userId: 'user-1', refreshDigest: 'revoked-digest', expiresAt: 102, revoked: true });
    expect(await sessions.pruneExpired(100)).toBe(1);
    expect(await sessions.get('expired')).toBeNull();
    expect(await sessions.get('revoked')).toMatchObject({ revoked: true });
    await expect(sessions.rotate('expired-current', 'invalid', 100)).rejects.toThrow('Invalid credentials');
    await expect(sessions.rotate('active-old', 'replay', 100)).rejects.toThrow('Invalid credentials');
    expect(await sessions.get('active')).toMatchObject({ revoked: true });
    // Reusing a fixture digest proves the removed family's history index was cleared.
    await expect(sessions.create({ id: 'replacement', userId: 'user-1', refreshDigest: 'old-digest', expiresAt: 200, revoked: false })).resolves.toBeUndefined();
  });

  it('bounds cleanup batches and can repeat cleanup without affecting unexpired sessions', async () => {
    const sessions = new InMemorySessionStore();
    for (const [id, expiry] of [['early', 99], ['boundary', 100], ['active', 101]] as const) {
      await sessions.create({ id, userId: 'user-1', refreshDigest: id, expiresAt: expiry, revoked: false });
    }
    expect(await sessions.pruneExpired(100, 1)).toBe(1);
    expect(await sessions.get('early')).toBeNull();
    expect(await sessions.get('boundary')).not.toBeNull();
    expect(await sessions.pruneExpired(100, 1)).toBe(1);
    expect(await sessions.pruneExpired(100, 1)).toBe(0);
    expect(await sessions.get('active')).not.toBeNull();
  });

  it.each([[-1, 1], [100.5, 1], [Number.NaN, 1], [100, 0], [100, 1.5], [100, 1001]])('rejects unsafe cleanup cutoff %s or batch size %s without deleting state', async (now, limit) => {
    const sessions = new InMemorySessionStore();
    await sessions.create({ id: 'expired', userId: 'user-1', refreshDigest: 'digest', expiresAt: 1, revoked: false });
    await expect(sessions.pruneExpired(now, limit)).rejects.toThrow('Invalid session cleanup parameters');
    expect(await sessions.get('expired')).not.toBeNull();
  });

  it('rotates refresh tokens, stores only digests, and retains the absolute expiry', async () => {
    let date = new Date('2026-10-02T00:00:00Z');
    const sessions = new InMemorySessionStore();
    const tokens = new JwtTokenService(() => date, undefined, sessions);
    const original = await tokens.issue('user-1');
    const id = decodeJwt(original.access_token).sid as string;
    const before = (await sessions.get(id))!;
    expect(before.refreshDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(before)).not.toContain(original.refresh_token);
    date = new Date(date.getTime() + 600000);
    const rotated = await tokens.refresh(original.refresh_token);
    expect(rotated.refresh_token).not.toBe(original.refresh_token);
    expect(rotated.access_token).not.toBe(original.access_token);
    const after = (await sessions.get(id))!;
    expect(after.expiresAt).toBe(before.expiresAt);
    expect(after.refreshDigest).not.toBe(before.refreshDigest);
    await expect(tokens.verify(rotated.access_token)).resolves.toEqual({ id: 'user-1', roles: ['user'] });
    await expect(tokens.verify(original.access_token)).resolves.toEqual({ id: 'user-1', roles: ['user'] });
  });

  it('revokes the entire family on replay while leaving independent sessions usable', async () => {
    const tokens = new JwtTokenService();
    const original = await tokens.issue('user-1');
    const independent = await tokens.issue('user-1');
    const rotated = await tokens.refresh(original.refresh_token);
    await expect(tokens.refresh(original.refresh_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(original.access_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(rotated.access_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.refresh(rotated.refresh_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(independent.access_token)).resolves.toEqual({ id: 'user-1', roles: ['user'] });
  });

  it('atomically detects two competing refresh requests and invalidates their family', async () => {
    const tokens = new JwtTokenService();
    const original = await tokens.issue('user-1');
    const results = await Promise.allSettled([tokens.refresh(original.refresh_token), tokens.refresh(original.refresh_token)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = results.find((result) => result.status === 'fulfilled');
    if (!winner || winner.status !== 'fulfilled') throw new Error('Expected one rotation');
    await expect(tokens.verify(winner.value.access_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.refresh(winner.value.refresh_token)).rejects.toThrow('Invalid credentials');
  });

  it('logs out the family through any valid access token, including a pre-refresh token', async () => {
    const tokens = new JwtTokenService();
    const original = await tokens.issue('user-1');
    const rotated = await tokens.refresh(original.refresh_token);
    const revoked = await tokens.revoke(original.access_token);
    expect(revoked).toEqual({ userId: 'user-1', sessionId: decodeJwt(original.access_token).sid });
    await expect(tokens.verify(rotated.access_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.refresh(rotated.refresh_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.revoke(original.access_token)).rejects.toThrow('Invalid credentials');
  });

  it('allows refresh after access expiry but rejects refresh at the seven-day session expiry', async () => {
    let date = new Date('2026-10-02T00:00:00Z');
    const start = date.getTime();
    const tokens = new JwtTokenService(() => date);
    const original = await tokens.issue('user-1');
    date = new Date(start + 901000);
    await expect(tokens.verify(original.access_token)).rejects.toThrow('Invalid credentials');
    const first = await tokens.refresh(original.refresh_token);
    await expect(tokens.verify(first.access_token)).resolves.toMatchObject({ id: 'user-1' });
    date = new Date(start + (7 * 86400 - 10) * 1000);
    const last = await tokens.refresh(first.refresh_token);
    expect(last.expires_in).toBe(10);
    date = new Date(start + 7 * 86400 * 1000);
    await expect(tokens.refresh(last.refresh_token)).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(last.access_token)).rejects.toThrow('Invalid credentials');
  });

  it('rejects unknown and malformed refresh tokens without affecting a valid session', async () => {
    const tokens = new JwtTokenService();
    const original = await tokens.issue('user-1');
    await expect(tokens.refresh('malformed')).rejects.toThrow('Invalid credentials');
    await expect(tokens.refresh(randomBytes(32).toString('base64url'))).rejects.toThrow('Invalid credentials');
    await expect(tokens.verify(original.access_token)).resolves.toMatchObject({ id: 'user-1' });
  });

  it('rotates signing keys while retaining previous verification keys and active sessions', async () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const sessions = new InMemorySessionStore();
    const oldService = new JwtTokenService(undefined, { activeKeyId: 'old', keys: { old: oldKey } }, sessions);
    const original = await oldService.issue('user-1');
    const rotatedService = new JwtTokenService(undefined, { activeKeyId: 'new', keys: { old: oldKey, new: newKey } }, sessions);
    await expect(rotatedService.verify(original.access_token)).resolves.toMatchObject({ id: 'user-1' });
    const rotated = await rotatedService.refresh(original.refresh_token);
    expect(decodeProtectedHeader(rotated.access_token).kid).toBe('new');
    const retiredService = new JwtTokenService(undefined, { activeKeyId: 'new', keys: { new: newKey } }, sessions);
    await expect(retiredService.verify(original.access_token)).rejects.toThrow('Invalid credentials');
    await expect(retiredService.verify(rotated.access_token)).resolves.toMatchObject({ id: 'user-1' });
  });

  it('fails closed when signing keys survive but session state is lost', async () => {
    const key = randomBytes(32);
    const original = await new JwtTokenService(undefined, key).issue('user-1');
    const restarted = new JwtTokenService(undefined, key);
    await expect(restarted.verify(original.access_token)).rejects.toThrow('Invalid credentials');
    await expect(restarted.refresh(original.refresh_token)).rejects.toThrow('Invalid credentials');
  });
});
