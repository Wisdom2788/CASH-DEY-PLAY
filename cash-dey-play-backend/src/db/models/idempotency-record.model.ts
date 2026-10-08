export interface IdempotencyRecordRow {
  readonly user_id: string;
  readonly endpoint: string;
  readonly idempotency_key: string;
  readonly response_body: unknown;
  readonly created_at: Date;
}
