import type { SessionRecord, SessionStore, SessionMaintenance } from '../../public/auth-contracts.js';
import { RefreshTokenReuseError } from '../../public/auth-contracts.js';
import { validateSessionCleanup } from './session-cleanup.js';

export class InMemorySessionStore implements SessionStore, SessionMaintenance {
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

  async pruneExpired(now: number, limit = 100): Promise<number> {
    validateSessionCleanup(now, limit);
    const expired = [...this.sessions.values()].filter((session) => session.expiresAt <= now)
      .sort((a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id)).slice(0, limit);
    const ids = new Set(expired.map((session) => session.id));
    for (const id of ids) this.sessions.delete(id);
    for (const [digest, id] of this.refreshIndex) if (ids.has(id)) this.refreshIndex.delete(digest);
    return expired.length;
  }
}
