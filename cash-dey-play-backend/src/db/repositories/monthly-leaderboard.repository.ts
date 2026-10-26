import { Pool } from "pg";
import { startOfCalendarMonth, startOfNextCalendarMonth } from "../../time/lagos-calendar-clock";
import { type MonthlyLeaderboardEligibilityInput } from "../../qualification/monthly-leaderboard/monthly-leaderboard.types";

export interface IMonthlyLeaderboardRepository {
  getUserActivity(userId: string, monthKey: string): Promise<MonthlyLeaderboardEligibilityInput>;
}

export class PostgresMonthlyLeaderboardRepository implements IMonthlyLeaderboardRepository {
  constructor(private readonly pool: Pool) {}

  async getUserActivity(userId: string, monthKey: string): Promise<MonthlyLeaderboardEligibilityInput> {
    const monthStart = startOfCalendarMonth(monthKey);
    const nextMonthStart = startOfNextCalendarMonth(monthKey);

    const tasksQuery = `
      SELECT COUNT(*) AS distinct_task_days FROM (
        SELECT lagos_date FROM qualified_task_days WHERE user_id=$1 AND lagos_date >= $2::date AND lagos_date < $3::date
      ) complete_days
    `;
    const matchesQuery = `
      SELECT COUNT(*) AS total_wins
      FROM ranked_results
      WHERE user_id = $1
        AND outcome = 'WIN'
        AND lagos_date >= $2::date
        AND lagos_date < $3::date
    `;

    const [tasksResult, matchesResult] = await Promise.all([
      this.pool.query<{ distinct_task_days: string }>(tasksQuery, [userId, monthStart, nextMonthStart]),
      this.pool.query<{ total_wins: string }>(matchesQuery, [userId, monthStart, nextMonthStart]),
    ]);

    return {
      distinctTaskCompletionDays: parseInt(tasksResult.rows[0]?.distinct_task_days ?? "0", 10),
      totalMatchWins: parseInt(matchesResult.rows[0]?.total_wins ?? "0", 10),
    };
  }
}
