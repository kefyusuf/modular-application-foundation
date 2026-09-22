import type { DomainEvent } from '../../../kernel/ports.js';
import type { NotificationSender } from '../public/notification-sender.js';

export function createWelcomeEmailSubscriber(sender: NotificationSender) {
  return async function onDomainEvent(event: DomainEvent): Promise<void> {
    if (event.type !== 'identity.user.registered.v1') {
      return;
    }
    await sender.send({
      channel: 'email',
      to: String(event.data.email ?? ''),
      subject: 'Welcome',
      body: 'Your account was created.',
    });
  };
}
