import { Pool } from "pg";

export const LOGIN_STREAK_CLAIM_ENDPOINT = "POST /api/login-streak/claim";

export interface IIdempotencyRepository {
  find<T>(userId: string, endpoint: string, idempotencyKey: string): Promise<T | null>;
  save(userId: string, endpoint: string, idempotencyKey: string, responseBody: unknown): Promise<void>;
}

export class PostgresIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly pool: Pool) {}

  async find<T>(userId: string, endpoint: string, idempotencyKey: string): Promise<T | null> {
    const query = `
      SELECT response_body
      FROM idempotency_keys
      WHERE user_id = $1 AND endpoint = $2 AND idempotency_key = $3
    `;
    const result = await this.pool.query<{ response_body: T }>(query, [userId, endpoint, idempotencyKey]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].response_body;
  }

  async save(userId: string, endpoint: string, idempotencyKey: string, responseBody: unknown): Promise<void> {
    const query = `
      INSERT INTO idempotency_keys (user_id, endpoint, idempotency_key, response_body)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (user_id, endpoint, idempotency_key) DO NOTHING
    `;
    await this.pool.query(query, [userId, endpoint, idempotencyKey, JSON.stringify(responseBody)]);
  }
}
