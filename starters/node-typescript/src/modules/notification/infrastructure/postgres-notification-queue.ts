import type { SqlDatabase } from '../../../kernel/sql.js';
import type { NotificationMessage, NotificationSender } from '../public/notification-sender.js';

// This adapter durably queues an intent; it does not send to an external provider.
export class PostgresNotificationQueue implements NotificationSender {
  constructor(private readonly database: SqlDatabase) {}

  async send(message: NotificationMessage, idempotencyKey?: string): Promise<void> {
    await this.database.query('INSERT INTO notification.messages (event_id, message) VALUES ($1, $2::jsonb) ON CONFLICT (event_id) DO NOTHING', [idempotencyKey ?? null, JSON.stringify(message)]);
  }

  async list(): Promise<NotificationMessage[]> {
    const { rows } = await this.database.query<{ message: NotificationMessage }>('SELECT message FROM notification.messages ORDER BY id');
    return rows.map((row) => row.message);
  }
}
