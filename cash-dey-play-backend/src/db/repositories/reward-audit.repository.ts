import { Pool } from "pg";
import { type NewRewardAuditEvent } from "../models/reward-audit-event.model";

export interface IRewardAuditRepository {
  append(event: NewRewardAuditEvent): Promise<void>;
}

export class PostgresRewardAuditRepository implements IRewardAuditRepository {
  constructor(private readonly pool: Pool) {}

  async append(event: NewRewardAuditEvent): Promise<void> {
    const query = `
      INSERT INTO reward_audit_events (user_id, event_type, amount_kobo, reason, triggering_rule)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(query, [
      event.userId,
      event.eventType,
      event.amountKobo,
      event.reason,
      event.triggeringRule,
    ]);
  }
}
