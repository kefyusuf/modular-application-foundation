import type { SigningKeyRing } from '../modules/identity/public/auth-contracts.js';

export function readTokenKeyRing(env: NodeJS.ProcessEnv): SigningKeyRing | undefined {
  const activeKeyId = env.JWT_ACTIVE_KEY_ID;
  const encodedKeys = env.JWT_SIGNING_KEYS;
  if (!activeKeyId && !encodedKeys) {
    if (env.NODE_ENV === 'production') throw new Error('Production requires JWT_ACTIVE_KEY_ID and JWT_SIGNING_KEYS');
    return undefined;
  }
  if (!activeKeyId || !encodedKeys) throw new Error('JWT_ACTIVE_KEY_ID and JWT_SIGNING_KEYS must be configured together');
  let parsed: unknown;
  try { parsed = JSON.parse(encodedKeys); } catch { throw new Error('JWT_SIGNING_KEYS must be a JSON object of base64url keys'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JWT_SIGNING_KEYS must be a JSON object of base64url keys');
  const keys: Record<string, Uint8Array> = Object.fromEntries(Object.entries(parsed).map(([id, value]) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid JWT key configuration');
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length < 32 || bytes.toString('base64url') !== value) throw new Error('JWT keys must be canonical base64url containing at least 32 bytes');
    return [id, bytes];
  }));
  if (!Object.hasOwn(keys, activeKeyId)) throw new Error('Active JWT signing key is missing');
  return { activeKeyId, keys };
}
