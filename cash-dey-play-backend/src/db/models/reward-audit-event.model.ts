export interface RewardAuditEventRow {
  readonly id: number;
  readonly user_id: string;
  readonly occurred_at: Date;
  readonly event_type: string;
  readonly amount_kobo: number | null;
  readonly reason: string;
  readonly triggering_rule: string;
}

export interface NewRewardAuditEvent {
  readonly userId: string;
  readonly eventType: string;
  readonly amountKobo: number | null;
  readonly reason: string;
  readonly triggeringRule: string;
}
