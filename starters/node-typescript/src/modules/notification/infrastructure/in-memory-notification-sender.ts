import type { NotificationMessage, NotificationSender } from '../public/notification-sender.js';

export class InMemoryNotificationSender implements NotificationSender {
  readonly sent: NotificationMessage[] = [];

  async send(message: NotificationMessage): Promise<void> {
    this.sent.push(message);
  }
}
