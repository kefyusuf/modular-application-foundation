import type { SqlDatabase } from '../../../../kernel/sql.js';
import type { SessionRecord, SessionStore } from '../../public/auth-contracts.js';
import { RefreshTokenReuseError } from '../../public/auth-contracts.js';

type SessionRow = { id: string; user_id: string; refresh_digest: string; expires_at: string | number; revoked: boolean };

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly database: SqlDatabase) {}

  async create(session: SessionRecord): Promise<void> {
    await this.database.withinTransaction(async () => {
      await this.database.query('INSERT INTO identity.sessions (id, user_id, refresh_digest, expires_at, revoked) VALUES ($1, $2, $3, $4, $5)', [session.id, session.userId, session.refreshDigest, session.expiresAt, session.revoked]);
      await this.database.query('INSERT INTO identity.refresh_tokens (digest, session_id) VALUES ($1, $2)', [session.refreshDigest, session.id]);
    });
  }

  async get(id: string): Promise<SessionRecord | null> {
    const { rows } = await this.database.query<SessionRow>('SELECT * FROM identity.sessions WHERE id = $1', [id]);
    return rows[0] ? this.restore(rows[0]) : null;
  }

  async rotate(digest: string, nextDigest: string, now: number): Promise<SessionRecord> {
    const outcome = await this.database.withinTransaction(async () => {
      const { rows } = await this.database.query<SessionRow>(`SELECT s.* FROM identity.sessions s
        JOIN identity.refresh_tokens r ON r.session_id = s.id WHERE r.digest = $1 FOR UPDATE OF s`, [digest]);
      const session = rows[0] ? this.restore(rows[0]) : null;
      if (!session || session.revoked || session.expiresAt <= now) throw new Error('Invalid credentials');
      if (session.refreshDigest !== digest) {
        await this.revoke(session.id);
        return { reused: true, session };
      }
      await this.database.query('UPDATE identity.sessions SET refresh_digest = $2 WHERE id = $1', [session.id, nextDigest]);
      await this.database.query('INSERT INTO identity.refresh_tokens (digest, session_id) VALUES ($1, $2)', [nextDigest, session.id]);
      return { reused: false, session: { ...session, refreshDigest: nextDigest } };
    });
    // Throw after the standalone transaction commits; replay revocation must survive rejection.
    if (outcome.reused) throw new RefreshTokenReuseError(outcome.session.userId, outcome.session.id);
    return outcome.session;
  }

  async revoke(id: string): Promise<void> {
    await this.database.query('UPDATE identity.sessions SET revoked = true WHERE id = $1', [id]);
  }

  private restore(row: SessionRow): SessionRecord {
    return { id: row.id, userId: row.user_id, refreshDigest: row.refresh_digest, expiresAt: Number(row.expires_at), revoked: row.revoked };
  }
}
