import { requireUserId } from "../middleware/auth.middleware";
import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";
import { NotImplementedFeatureError } from "../errors/http-errors";

export class MatchController {
  constructor(private readonly pool: Pool) {}

  getRecentOpponents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      // Get recent distinct opponents from matches
      const result = await this.pool.query<{id:string;username:string|null;avatar_url:string|null;matches_won_month:number}>(
        `SELECT DISTINCT ON (u.id) u.id, u.username, u.avatar_url, u.matches_won_month
         FROM matches m
         JOIN users u ON (
           CASE WHEN m.user_id = $1 THEN m.winner_id ELSE m.user_id END = u.id
         )
         WHERE (m.user_id = $1 OR m.winner_id = $1) AND u.id != $1
         ORDER BY u.id, m.created_at DESC
         LIMIT 10`,
        [userId]
      );
      const opponents = result.rows.map((row) => ({
        id: row.id,
        username: row.username || "Player",
        avatarUrl: row.avatar_url || "",
        cardCount: 0,
        isOnline: false,
        score: row.matches_won_month || 0,
      }));
      res.json({ data: opponents });
    } catch (error) {
      next(error);
    }
  };

  startMatch = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Starting a match"));
  };

  makeMove = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Playing a card"));
  };

  drawCard = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Drawing a card"));
  };

  forfeit = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Forfeiting a match"));
  };
}
