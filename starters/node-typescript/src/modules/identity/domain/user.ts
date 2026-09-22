import type { DomainEvent } from '../../../kernel/ports.js';
import { Email } from './email.js';
import { userRegistered } from './events.js';

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    private readonly passwordHash: string,
    private domainEvents: DomainEvent[],
  ) {}

  static register(id: string, email: Email, passwordHash: string): User {
    if (passwordHash.length < 8) {
      throw new Error('Password hash too short');
    }
    const user = new User(id, email, passwordHash, []);
    user.domainEvents.push(userRegistered(id, email.value));
    return user;
  }

  verifyPassword(passwordHash: string): boolean {
    return this.passwordHash === passwordHash;
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
