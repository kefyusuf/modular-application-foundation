import type { Actor } from '../../../kernel/ports.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, digest: string): Promise<boolean>;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface TokenService {
  issue(userId: string): Promise<AuthTokens>;
  verify(accessToken: string): Promise<Actor>;
}

export interface SigningKeyRing {
  activeKeyId: string;
  keys: Record<string, Uint8Array>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshDigest: string;
  expiresAt: number;
  revoked: boolean;
}

export interface SessionStore {
  create(session: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | null>;
  // Atomically consume a refresh digest and replace it. Reuse revokes the family.
  rotate(refreshDigest: string, nextDigest: string, now: number): Promise<SessionRecord>;
  revoke(sessionId: string): Promise<void>;
}

export interface SessionMaintenance {
  // Remove expired families and their refresh history in a bounded operation.
  pruneExpired(now: number, limit?: number): Promise<number>;
}

export class RefreshTokenReuseError extends Error {
  constructor(public readonly userId: string, public readonly sessionId: string) {
    super('Invalid credentials');
    this.name = 'RefreshTokenReuseError';
  }
}

export interface SessionTokenService extends TokenService {
  refresh(refreshToken: string): Promise<AuthTokens>;
  revoke(accessToken: string): Promise<{ userId: string; sessionId: string }>;
}
