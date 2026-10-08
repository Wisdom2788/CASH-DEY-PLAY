import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";

export class MatchController {
  constructor(private readonly pool: Pool) {}

  getRecentOpponents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      // Get recent distinct opponents from matches
      const result = await this.pool.query(
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
      const opponents = result.rows.map((row: any) => ({
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

  startMatch = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Match start will be handled by Socket.io in production
      // This REST endpoint returns a placeholder match state for now
      res.json({
        data: null,
        message: "Match start is handled via Socket.io. Connect to the socket server to start a match.",
      });
    } catch (error) {
      next(error);
    }
  };

  makeMove = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: null, message: "Moves are handled via Socket.io" });
    } catch (error) {
      next(error);
    }
  };

  drawCard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: null, message: "Draw is handled via Socket.io" });
    } catch (error) {
      next(error);
    }
  };

  forfeit = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: null, message: "Forfeit is handled via Socket.io" });
    } catch (error) {
      next(error);
    }
  };
}
