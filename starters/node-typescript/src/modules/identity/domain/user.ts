import type { DomainEvent } from '../../../kernel/ports.js';
import { Email } from './email.js';
import { userRegistered } from './events.js';

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    private domainEvents: DomainEvent[],
  ) {}

  static register(id: string, email: Email, passwordHash: string): User {
    if (passwordHash.length < 8) {
      throw new Error('Password hash too short');
    }
    const user = new User(id, email, []);
    user.domainEvents.push(userRegistered(id, email.value));
    return user;
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
