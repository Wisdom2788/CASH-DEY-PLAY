import { Pool } from "pg";
import { type LoginStreakState } from "../../qualification/login-streak/login-streak.types";
import { type LoginStreakRow } from "../models/login-streak.model";

export interface ILoginStreakRepository {
  getState(userId: string): Promise<LoginStreakState | null>;
  saveState(userId: string, state: LoginStreakState): Promise<void>;
}

function mapRowToState(row: LoginStreakRow): LoginStreakState {
  return {
    windowStartDate: row.window_start_date.slice(0, 10),
    lastLoginDate: row.last_login_date.slice(0, 10),
    consecutiveLoginDaysCount: Number(row.consecutive_login_days_count),
    graceDaysUsed: Number(row.grace_days_used),
    hasClaimedBonus: Boolean(row.has_claimed_bonus),
  };
}

export class PostgresLoginStreakRepository implements ILoginStreakRepository {
  constructor(private readonly pool: Pool) {}

  async getState(userId: string): Promise<LoginStreakState | null> {
    const query = `
      SELECT
        window_start_date::text AS window_start_date,
        last_login_date::text AS last_login_date,
        consecutive_login_days_count,
        grace_days_used,
        has_claimed_bonus
      FROM login_streaks
      WHERE user_id = $1
    `;
    const result = await this.pool.query<LoginStreakRow>(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToState(result.rows[0]);
  }

  async saveState(userId: string, state: LoginStreakState): Promise<void> {
    const query = `
      INSERT INTO login_streaks (
        user_id, window_start_date, last_login_date, consecutive_login_days_count, grace_days_used, has_claimed_bonus, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        window_start_date = EXCLUDED.window_start_date,
        last_login_date = EXCLUDED.last_login_date,
        consecutive_login_days_count = EXCLUDED.consecutive_login_days_count,
        grace_days_used = EXCLUDED.grace_days_used,
        has_claimed_bonus = EXCLUDED.has_claimed_bonus,
        updated_at = NOW()
    `;
    await this.pool.query(query, [
      userId,
      state.windowStartDate,
      state.lastLoginDate,
      state.consecutiveLoginDaysCount,
      state.graceDaysUsed,
      state.hasClaimedBonus,
    ]);
  }
}
