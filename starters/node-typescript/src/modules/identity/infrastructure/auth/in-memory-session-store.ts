import type { SessionRecord, SessionStore } from '../../public/auth-contracts.js';
import { RefreshTokenReuseError } from '../../public/auth-contracts.js';

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  // Retain consumed digests so replay can identify and revoke the session family.
  private readonly refreshIndex = new Map<string, string>();

  async create(session: SessionRecord): Promise<void> {
    if (this.sessions.has(session.id) || this.refreshIndex.has(session.refreshDigest)) throw new Error('Duplicate session');
    this.sessions.set(session.id, { ...session });
    this.refreshIndex.set(session.refreshDigest, session.id);
  }

  async get(sessionId: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async rotate(refreshDigest: string, nextDigest: string, now: number): Promise<SessionRecord> {
    // No await inside this critical section: compare/replace is atomic in this adapter.
    const sessionId = this.refreshIndex.get(refreshDigest);
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session || session.revoked || session.expiresAt <= now) throw new Error('Invalid credentials');
    if (session.refreshDigest !== refreshDigest) {
      session.revoked = true;
      throw new RefreshTokenReuseError(session.userId, session.id);
    }
    if (this.refreshIndex.has(nextDigest)) throw new Error('Duplicate refresh digest');
    session.refreshDigest = nextDigest;
    this.refreshIndex.set(nextDigest, session.id);
    return { ...session };
  }

  async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.revoked = true;
  }
}
