import { randomUUID } from 'node:crypto';
import type { SqlDatabase } from '../../../../kernel/sql.js';
import type { DomainEvent, EventBus } from '../../../../kernel/ports.js';

export class PostgresOutboxEventBus implements EventBus {
  constructor(private readonly database: SqlDatabase) {}

  async publish(event: DomainEvent): Promise<void> {
    if (!event.type.startsWith('identity.')) throw new Error('Identity outbox only accepts identity events');
    const id = randomUUID();
    const data = Object.fromEntries(Object.entries(event.data).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]));
    const envelope = {
      specversion: '1.0', id, source: 'mod://identity', type: event.type,
      subject: event.data.sessionId ? `session/${event.data.sessionId}` : `user/${event.data.userId ?? 'unknown'}`,
      time: event.occurredAt, datacontenttype: 'application/json', correlationid: id, data,
    };
    await this.database.query('INSERT INTO identity.outbox (id, event, envelope, occurred_at) VALUES ($1, $2::jsonb, $3::jsonb, $4)', [id, JSON.stringify(event), JSON.stringify(envelope), event.occurredAt]);
  }
}

export class PostgresOutboxDispatcher {
  constructor(private readonly database: SqlDatabase, private readonly delivery: EventBus) {}

  async drain(limit = 20): Promise<{ delivered: number; failed: number }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Outbox batch limit must be between 1 and 100');
    let delivered = 0;
    let failed = 0;
    for (let i = 0; i < limit; i++) {
      const claimId = randomUUID();
      const { rows } = await this.database.query<{ id: string; event: DomainEvent }>(`WITH pending AS (
        SELECT id FROM identity.outbox WHERE delivered_at IS NULL AND available_at <= now()
          AND (claimed_until IS NULL OR claimed_until <= now())
        ORDER BY occurred_at, id FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE identity.outbox o SET claim_id = $1, claimed_until = now() + interval '30 seconds', attempts = attempts + 1
        FROM pending WHERE o.id = pending.id RETURNING o.id, o.event`, [claimId]);
      const record = rows[0];
      if (!record) break;
      try {
        // Subscriber work runs outside the producer transaction. Delivery is at least once.
        await this.delivery.publish({ ...record.event, id: record.id });
        const acknowledged = await this.database.query('UPDATE identity.outbox SET delivered_at = now(), claimed_until = NULL, claim_id = NULL, last_error = NULL WHERE id = $1 AND claim_id = $2', [record.id, claimId]);
        if (acknowledged.rowCount === 1) delivered++; else failed++;
      } catch {
        failed++;
        await this.database.query(`UPDATE identity.outbox SET claimed_until = NULL, claim_id = NULL,
          available_at = now() + make_interval(secs => LEAST(60, attempts)), last_error = 'Subscriber delivery failed'
          WHERE id = $1 AND claim_id = $2`, [record.id, claimId]);
      }
    }
    return { delivered, failed };
  }
}
