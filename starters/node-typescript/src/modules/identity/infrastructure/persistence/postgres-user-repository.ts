import type { SqlDatabase } from '../../../../kernel/sql.js';
import type { UserRepository } from '../../application/ports.js';
import { User } from '../../domain/user.js';
import { Email } from '../../domain/email.js';

type UserRow = { id: string; email: string; password_digest: string };

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: SqlDatabase) {}

  async get(id: string): Promise<User> {
    const { rows } = await this.database.query<UserRow>('SELECT id, email, password_digest FROM identity.users WHERE id = $1', [id]);
    if (!rows[0]) throw new Error('User not found');
    return this.restore(rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.database.query<UserRow>('SELECT id, email, password_digest FROM identity.users WHERE email = $1', [email.trim().toLowerCase()]);
    return rows[0] ? this.restore(rows[0]) : null;
  }

  async save(user: User, expectedVersion: number): Promise<void> {
    try {
      const result = expectedVersion === 0
        ? await this.database.query('INSERT INTO identity.users (id, email, password_digest, version) VALUES ($1, $2, $3, 1)', [user.id, user.email.value, user.getPasswordDigest()])
        : await this.database.query('UPDATE identity.users SET email = $2, password_digest = $3, version = version + 1 WHERE id = $1 AND version = $4', [user.id, user.email.value, user.getPasswordDigest(), expectedVersion]);
      if (result.rowCount !== 1) throw new Error('Concurrency conflict');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new Error('constraint' in error && error.constraint === 'users_email_key' ? 'Email already used' : 'Concurrency conflict');
      }
      throw error;
    }
  }

  private restore(row: UserRow): User { return User.restore(row.id, Email.from(row.email), row.password_digest); }
}
