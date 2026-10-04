import type { SqlDatabase } from '../../../../kernel/sql.js';

export interface OutboxStatus {
  pending: number;
  ready: number;
  leased: number;
  deferred: number;
  delivered: number;
  attemptedPending: number;
  oldestPendingAt: string | null;
}

type StatusRow = { [Key in Exclude<keyof OutboxStatus, 'oldestPendingAt'>]: string | number }
  & { oldestPendingAt: Date | string | null };

export class PostgresOutboxStatusReader {
  constructor(private readonly database: SqlDatabase) {}

  async read(): Promise<OutboxStatus> {
    const { rows } = await this.database.query<StatusRow>(`SELECT
      count(*) FILTER (WHERE delivered_at IS NULL) AS pending,
      count(*) FILTER (WHERE delivered_at IS NULL AND available_at <= now()
        AND (claimed_until IS NULL OR claimed_until <= now())) AS ready,
      count(*) FILTER (WHERE delivered_at IS NULL AND claimed_until > now()) AS leased,
      count(*) FILTER (WHERE delivered_at IS NULL AND available_at > now()
        AND (claimed_until IS NULL OR claimed_until <= now())) AS deferred,
      count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
      count(*) FILTER (WHERE delivered_at IS NULL AND attempts > 0) AS "attemptedPending",
      min(occurred_at) FILTER (WHERE delivered_at IS NULL) AS "oldestPendingAt"
      FROM identity.outbox`);
    const row = rows[0];
    return {
      pending: Number(row.pending), ready: Number(row.ready), leased: Number(row.leased),
      deferred: Number(row.deferred), delivered: Number(row.delivered), attemptedPending: Number(row.attemptedPending),
      oldestPendingAt: row.oldestPendingAt === null ? null : new Date(row.oldestPendingAt).toISOString(),
    };
  }
}
