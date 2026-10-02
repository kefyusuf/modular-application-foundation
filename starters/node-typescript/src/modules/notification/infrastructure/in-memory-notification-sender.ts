import type { NotificationMessage, NotificationSender } from '../public/notification-sender.js';

export class InMemoryNotificationSender implements NotificationSender {
  readonly sent: NotificationMessage[] = [];
  private readonly delivered = new Set<string>();

  async list(): Promise<NotificationMessage[]> { return [...this.sent]; }

  async send(message: NotificationMessage, idempotencyKey?: string): Promise<void> {
    if (idempotencyKey && this.delivered.has(idempotencyKey)) return;
    this.sent.push(message);
    if (idempotencyKey) this.delivered.add(idempotencyKey);
  }
}
