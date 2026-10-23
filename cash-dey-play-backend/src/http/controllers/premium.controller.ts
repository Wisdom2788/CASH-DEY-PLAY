import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";

export class PremiumController {
  constructor(private readonly pool: Pool) {}

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const result = await this.pool.query(
        `SELECT is_active, expires_at FROM premium_subscriptions
         WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()`,
        [userId]
      );
      res.json({
        data: {
          isPremium: result.rows.length > 0,
          expiresAt: result.rows[0]?.expires_at || null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
