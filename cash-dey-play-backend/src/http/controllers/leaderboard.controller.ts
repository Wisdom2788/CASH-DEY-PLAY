import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";

export class LeaderboardController {
  constructor(private readonly pool: Pool) {}

  getGameLeaderboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.pool.query(
        `SELECT id, username, avatar_url, matches_won_month, matches_played_month,
                xp, points, monthly_rank
         FROM users
         WHERE matches_played_month > 0
         ORDER BY matches_won_month DESC, xp DESC
         LIMIT 100`
      );

      const leaderboard = result.rows.map((row: any, index: number) => {
        const played = row.matches_played_month || 1;
        const won = row.matches_won_month || 0;
        const winRate = won / played;
        const weightedScore = parseFloat((winRate * (played / 50)).toFixed(3));

        return {
          userId: row.id,
          rank: index + 1,
          username: row.username || "Player",
          avatarUrl: row.avatar_url || "",
          matchesWon: won,
          matchesPlayed: played,
          winRate,
          weightedScore,
        };
      });

      res.json({ data: leaderboard });
    } catch (error) {
      next(error);
    }
  };

  getCommunityLeaderboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.pool.query(
        `SELECT r.referrer_id, u.username, u.avatar_url,
                COUNT(*) FILTER (WHERE r.is_qualified) as qualifying_invites,
                COUNT(*) as total_invites
         FROM referrals r
         JOIN users u ON r.referrer_id = u.id
         GROUP BY r.referrer_id, u.username, u.avatar_url
         HAVING COUNT(*) FILTER (WHERE r.is_qualified) > 0
         ORDER BY qualifying_invites DESC
         LIMIT 20`
      );



      const leaderboard = result.rows.map((row: any, index: number) => {
        const qualInvites = parseInt(row.qualifying_invites);
        let prizePercent = 0;
        if (index === 0) prizePercent = 50;
        else if (index === 1) prizePercent = 30;
        else if (index === 2) prizePercent = 20;

        return {
          userId: row.referrer_id,
          rank: index + 1,
          username: row.username || "Player",
          avatarUrl: row.avatar_url || "",
          qualifyingInviteCount: qualInvites,
          totalInvites: parseInt(row.total_invites),
          prizePercent,
        };
      });

      res.json({ data: leaderboard });
    } catch (error) {
      next(error);
    }
  };
}
