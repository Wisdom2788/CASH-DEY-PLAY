import { Pool } from "pg";
import { UserProfile } from "../../types"; // We will create this

export interface UserRepository {
  upsertTelegramUser(telegramId: number, firstName: string, username: string | null, avatarUrl: string | null): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async upsertTelegramUser(telegramId: number, firstName: string, username: string | null, avatarUrl: string | null): Promise<UserProfile> {
    const userId = `tg_${telegramId}`;
    const referralCode = `REF_${telegramId}`;
    
    const res = await this.pool.query(
      `INSERT INTO users (
         id, telegram_id, first_name, username, avatar_url, referral_code
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING *`,
      [userId, telegramId, firstName, username, avatarUrl, referralCode]
    );

    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const res = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  private mapRow(row: any): UserProfile {
    return {
      id: row.id,
      telegramId: Number(row.telegram_id),
      username: row.username,
      firstName: row.first_name,
      avatarUrl: row.avatar_url,
      isPhoneVerified: row.is_phone_verified,
      isPremium: row.is_premium,
      xp: row.xp,
      points: row.points,
      monthlyRank: row.monthly_rank,
      monthlyTrend: row.monthly_trend,
      matchesWonMonth: row.matches_won_month,
      matchesPlayedMonth: row.matches_played_month,
      referralCode: row.referral_code,
      activeTaskDaysCount: row.active_task_days_count,
    };
  }
}
