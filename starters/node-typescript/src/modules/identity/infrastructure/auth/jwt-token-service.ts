import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Actor } from '../../../../kernel/ports.js';
import type { AuthTokens, SessionRecord, SessionStore, SessionTokenService, SigningKeyRing } from '../../public/auth-contracts.js';
import { InMemorySessionStore } from './in-memory-session-store.js';

export class JwtTokenService implements SessionTokenService {
  private readonly keys = new Map<string, Uint8Array>();
  private readonly activeKeyId: string;
  private readonly issuer = 'modular-application-foundation';
  private readonly audience = 'foundation-api';
  private readonly lifetime = 900;
  private readonly sessionLifetime = 7 * 24 * 60 * 60;

  constructor(
    private readonly now: () => Date = () => new Date(),
    key: Uint8Array | SigningKeyRing = randomBytes(32),
    private readonly sessions: SessionStore = new InMemorySessionStore(),
  ) {
    const ring = key instanceof Uint8Array ? { activeKeyId: 'local', keys: { local: key } } : key;
    for (const [id, bytes] of Object.entries(ring.keys)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid JWT key ID');
      if (bytes.length < 32) throw new Error('JWT signing key must contain at least 32 bytes');
      this.keys.set(id, Uint8Array.from(bytes));
    }
    if (!this.keys.has(ring.activeKeyId)) throw new Error('Active JWT signing key is missing');
    this.activeKeyId = ring.activeKeyId;
  }

  async issue(userId: string): Promise<AuthTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const session: SessionRecord = {
      id: randomUUID(), userId, refreshDigest: this.digest(refreshToken),
      expiresAt: this.seconds() + this.sessionLifetime, revoked: false,
    };
    const tokens = await this.sign(session, refreshToken);
    await this.sessions.create(session);
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new Error('Invalid credentials');
    const replacement = randomBytes(32).toString('base64url');
    const session = await this.sessions.rotate(this.digest(refreshToken), this.digest(replacement), this.seconds());
    return this.sign(session, replacement);
  }

  async revoke(accessToken: string): Promise<{ userId: string; sessionId: string }> {
    const { actor, sessionId } = await this.authenticatedSession(accessToken);
    await this.sessions.revoke(sessionId);
    return { userId: actor.id, sessionId };
  }

  private seconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sign(session: SessionRecord, refreshToken: string): Promise<AuthTokens> {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = Math.min(issuedAt + this.lifetime, session.expiresAt);
    const accessToken = await new SignJWT({ roles: ['user'], sid: session.id })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt', kid: this.activeKeyId })
      .setSubject(session.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt)
      .setExpirationTime(expiresAt)
      .setJti(randomUUID())
      .sign(this.keys.get(this.activeKeyId)!);
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: expiresAt - issuedAt };
  }

  async verify(accessToken: string): Promise<Actor> {
    return (await this.authenticatedSession(accessToken)).actor;
  }

  private async authenticatedSession(accessToken: string): Promise<{ actor: Actor; sessionId: string }> {
    let actor: Actor;
    let sessionId: string;
    try {
      const { payload } = await jwtVerify(accessToken, (header) => {
        const key = typeof header.kid === 'string' ? this.keys.get(header.kid) : undefined;
        if (!key) throw new Error('Unknown JWT signing key');
        return key;
      }, {
        algorithms: ['HS256'], typ: 'at+jwt', issuer: this.issuer, audience: this.audience,
        requiredClaims: ['sub', 'iat', 'nbf', 'exp', 'jti', 'sid'], currentDate: this.now(),
      });
      if (!payload.sub || typeof payload.sid !== 'string' || !Array.isArray(payload.roles) || payload.roles.length !== 1 || payload.roles[0] !== 'user') throw new Error('Invalid claims');
      actor = { id: payload.sub, roles: ['user'] };
      sessionId = payload.sid;
    } catch {
      throw new Error('Invalid credentials');
    }
    const session = await this.sessions.get(sessionId);
    if (!session || session.revoked || session.expiresAt <= this.seconds() || session.userId !== actor.id) throw new Error('Invalid credentials');
    return { actor, sessionId };
  }
}
