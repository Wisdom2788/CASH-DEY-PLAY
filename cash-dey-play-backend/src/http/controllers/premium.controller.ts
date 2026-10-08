import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";

export class PremiumController {
  constructor(private readonly pool: Pool) {}

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;

      // Check if already premium
      const existing = await this.pool.query(
        `SELECT * FROM premium_subscriptions WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()`,
        [userId]
      );
      if (existing.rows.length > 0) {
        res.json({ data: { message: "Already subscribed to premium", status: 200 } });
        return;
      }

      // Create 30-day premium subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.pool.query(
        `INSERT INTO premium_subscriptions (user_id, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, expires_at = $2`,
        [userId, expiresAt.toISOString()]
      );

      await this.pool.query(
        `UPDATE users SET is_premium = TRUE, updated_at = NOW() WHERE id = $1`,
        [userId]
      );

      res.json({
        data: { message: "Premium subscription activated!", status: 200 },
        message: "Welcome to Premium! Enjoy enhanced rewards.",
      });
    } catch (error) {
      next(error);
    }
  };

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
