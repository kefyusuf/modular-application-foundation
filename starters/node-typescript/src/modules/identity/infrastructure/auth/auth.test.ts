import { randomBytes } from 'node:crypto';
import { SignJWT, decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';
import { JwtTokenService } from './jwt-token-service.js';

describe('password adapter', () => {
  it('salts hashes and verifies the password without accepting a digest as a password', async () => {
    const passwords = new ScryptPasswordHasher();
    const first = await passwords.hash('a-long-password');
    const second = await passwords.hash('a-long-password');
    expect(first).not.toBe(second);
    expect(first).not.toContain('a-long-password');
    await expect(passwords.verify('a-long-password', first)).resolves.toBe(true);
    await expect(passwords.verify('another-password', first)).resolves.toBe(false);
    await expect(passwords.verify(first, first)).resolves.toBe(false);
    await expect(passwords.verify('a-long-password', 'invalid-digest')).resolves.toBe(false);
  });
});

describe('JWT adapter', () => {
  it('issues unique tokens and rejects expired, altered, foreign, and refresh tokens', async () => {
    let date = new Date('2026-10-02T00:00:00Z');
    const tokens = new JwtTokenService(() => date);
    const first = await tokens.issue('user-1');
    const second = await tokens.issue('user-1');
    expect(first.access_token).not.toBe(second.access_token);
    expect(first.refresh_token).not.toBe(second.refresh_token);
    expect(first.expires_in).toBe(900);
    await expect(tokens.verify(first.access_token)).resolves.toEqual({ id: 'user-1', roles: ['user'] });
    await expect(tokens.verify(first.refresh_token)).rejects.toThrow('Invalid credentials');
    const parts = first.access_token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(first.access_token), sub: 'other-user' })).toString('base64url');
    await expect(tokens.verify(parts.join('.'))).rejects.toThrow('Invalid credentials');
    await expect(new JwtTokenService(() => date).verify(first.access_token)).rejects.toThrow('Invalid credentials');
    date = new Date(date.getTime() + first.expires_in * 1000);
    await expect(tokens.verify(first.access_token)).rejects.toThrow('Invalid credentials');
  });

  it.each(['issuer', 'audience', 'algorithm', 'type', 'not-before', 'roles', 'missing-expiry', 'missing-subject', 'missing-session', 'session-subject', 'missing-key', 'unknown-key'])('rejects an authenticated token with invalid %s', async (invalid) => {
    const key = randomBytes(32);
    const now = new Date('2026-10-02T00:00:00Z');
    const service = new JwtTokenService(() => now, key);
    const valid = await service.issue('user-1');
    await expect(service.verify(valid.access_token)).resolves.toEqual({ id: 'user-1', roles: ['user'] });
    const issuedAt = Math.floor(now.getTime() / 1000);
    const payload: Record<string, unknown> = {
      sid: decodeJwt(valid.access_token).sid,
      sub: 'user-1', iss: 'modular-application-foundation', aud: 'foundation-api',
      iat: issuedAt, nbf: issuedAt, exp: issuedAt + 900, jti: 'fixture', roles: ['user'],
    };
    if (invalid === 'issuer') payload.iss = 'different-issuer';
    if (invalid === 'audience') payload.aud = 'different-api';
    if (invalid === 'not-before') payload.nbf = issuedAt + 30;
    if (invalid === 'roles') payload.roles = ['admin'];
    if (invalid === 'missing-expiry') delete payload.exp;
    if (invalid === 'missing-subject') delete payload.sub;
    if (invalid === 'missing-session') delete payload.sid;
    if (invalid === 'session-subject') payload.sub = 'different-user';
    const token = await new SignJWT(payload).setProtectedHeader({
      alg: invalid === 'algorithm' ? 'HS384' : 'HS256', typ: invalid === 'type' ? 'JWT' : 'at+jwt',
      ...(invalid === 'missing-key' ? {} : { kid: invalid === 'unknown-key' ? 'unknown' : 'local' }),
    }).sign(key);
    await expect(service.verify(token)).rejects.toThrow('Invalid credentials');
  });

  it('rejects unsigned tokens and weak signing keys', async () => {
    const unsecured = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"user-1"}').toString('base64url')}.`;
    await expect(new JwtTokenService().verify(unsecured)).rejects.toThrow('Invalid credentials');
    expect(() => new JwtTokenService(undefined, randomBytes(16))).toThrow('at least 32 bytes');
  });
});
