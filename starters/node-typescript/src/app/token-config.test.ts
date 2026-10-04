import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readTokenKeyRing } from './token-config.js';

describe('JWT key configuration', () => {
  it('loads the active key and previous verification keys without changing their bytes', () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const config = readTokenKeyRing({ JWT_ACTIVE_KEY_ID: 'new', JWT_SIGNING_KEYS: JSON.stringify({ old: oldKey.toString('base64url'), new: newKey.toString('base64url') }) })!;
    expect(config.activeKeyId).toBe('new');
    expect(config.keys.old).toEqual(oldKey);
    expect(config.keys.new).toEqual(newKey);
  });

  it('permits an ephemeral development key but requires configured keys for production', () => {
    expect(readTokenKeyRing({})).toBeUndefined();
    expect(() => readTokenKeyRing({ NODE_ENV: 'production' })).toThrow('Production requires');
  });

  it.each([
    { JWT_ACTIVE_KEY_ID: 'main' },
    { JWT_SIGNING_KEYS: '{}' },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: 'not-json' },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: '[]' },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: '{}' },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: '{"main":"weak-secret"}' },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: JSON.stringify({ main: randomBytes(32).toString('base64') }) },
    { JWT_ACTIVE_KEY_ID: 'main', JWT_SIGNING_KEYS: JSON.stringify({ 'bad/key': randomBytes(32).toString('base64url') }) },
  ])('rejects incomplete or invalid configuration %# without exposing values', (env) => {
    expect(() => readTokenKeyRing(env)).toThrow();
    try { readTokenKeyRing(env); } catch (error) { expect(String(error)).not.toContain('weak-secret'); }
  });
});
