import type { User } from '../../domain/user.js';
import type { UserRepository } from '../../application/ports.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, { user: User; version: number }>();

  async get(id: string): Promise<User> {
    const row = this.users.get(id);
    if (!row) {
      throw new Error('User not found');
    }
    return row.user;
  }

  async save(aggregate: User, expectedVersion: number): Promise<void> {
    const row = this.users.get(aggregate.id);
    const current = row?.version ?? 0;
    if (current !== expectedVersion) {
      throw new Error('Concurrency conflict');
    }
    this.users.set(aggregate.id, { user: aggregate, version: expectedVersion + 1 });
  }
}
