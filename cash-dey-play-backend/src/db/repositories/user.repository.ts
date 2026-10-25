import { Pool } from "pg";
import { assignReferralCode, resolveReferral } from "../../entitlements/referrals";
import { PREMIUM_SQL } from "../../entitlements/entitlements";
import { UserProfile } from "../../types";

export interface AuthState { telegramId: number; tokenVersion: number; }
export interface UserRepository {
  upsertTelegramUser(telegramId: number, firstName: string, username: string | null, avatarUrl: string | null, startParam?: string | null): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
  findAuthState(id: string): Promise<AuthState | null>;
}
interface UserRow {
  id: string; telegram_id: string; first_name: string; username: string | null; avatar_url: string | null;
  is_phone_verified: boolean; is_premium: boolean; xp: number; points: number; monthly_rank: number | null;
  monthly_trend: number | null; matches_won_month: number; matches_played_month: number; referral_code: string | null;
  active_task_days_count: number; token_version: number;
}
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async upsertTelegramUser(telegramId: number, firstName: string, username: string | null, avatarUrl: string | null, startParam: string | null = null): Promise<UserProfile> {
    const id = `tg_${telegramId}`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const created = await client.query<UserRow>(`INSERT INTO users(id,telegram_id,first_name,username,avatar_url,referral_code)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(telegram_id) DO NOTHING RETURNING *`,
        [id,telegramId,firstName,username,avatarUrl,null]);
      let row = created.rows[0];
      if (row !== undefined) {
        await assignReferralCode(client,id);
        // Capture even a null start parameter on first creation; later links cannot overwrite attribution.
        await client.query("INSERT INTO first_login_attributions(user_id,start_param) VALUES($1,$2)",[id,startParam]);
      } else {
        const updated = await client.query<UserRow>(`UPDATE users SET first_name=$2, username=$3, avatar_url=$4, updated_at=now()
          WHERE telegram_id=$1 RETURNING *`,[telegramId,firstName,username,avatarUrl]);
        row = updated.rows[0];
      }
      if (row === undefined || row.id !== id) throw new Error("User identity invariant failed");
      await client.query("COMMIT");

    } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
    finally {client.release();}
    // Release before retry work: concurrent sign-ins must not reserve every pool connection.
    await resolveReferral(this.pool,id).catch(()=>undefined);
    const profile=await this.findById(id);
    if(!profile)throw new Error("Committed user missing");
    return profile;
  }

  async findAuthState(id: string): Promise<AuthState | null> {
    const result = await this.pool.query<{telegram_id:string;token_version:number}>("SELECT telegram_id,token_version FROM users WHERE id=$1",[id]);
    const row=result.rows[0];
    return row ? {telegramId:Number(row.telegram_id),tokenVersion:row.token_version} : null;
  }
  async findById(id: string): Promise<UserProfile | null> {
    const result = await this.pool.query<UserRow>(`SELECT u.*, ${PREMIUM_SQL} AS is_premium FROM users u WHERE id=$1`,[id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
  private mapRow(row: UserRow): UserProfile {
    return { id:row.id,telegramId:Number(row.telegram_id),firstName:row.first_name,username:row.username,
      avatarUrl:row.avatar_url,isPhoneVerified:row.is_phone_verified,isPremium:row.is_premium,xp:row.xp,points:row.points,
      monthlyRank:row.monthly_rank,monthlyTrend:row.monthly_trend,matchesWonMonth:row.matches_won_month,
      matchesPlayedMonth:row.matches_played_month,referralCode:row.referral_code,activeTaskDaysCount:row.active_task_days_count,
      tokenVersion:row.token_version };
  }
}
