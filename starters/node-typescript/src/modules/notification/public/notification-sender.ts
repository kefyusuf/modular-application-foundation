export interface NotificationMessage {
  channel: 'email' | 'sms' | 'push';
  to: string;
  subject: string;
  body: string;
}

export interface NotificationSender {
  send(message: NotificationMessage): Promise<void>;
}
