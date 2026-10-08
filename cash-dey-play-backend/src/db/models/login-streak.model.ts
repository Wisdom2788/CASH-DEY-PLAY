export interface LoginStreakRow {
  readonly user_id: string;
  readonly window_start_date: string;
  readonly last_login_date: string;
  readonly consecutive_login_days_count: number;
  readonly grace_days_used: number;
  readonly has_claimed_bonus: boolean;
}
