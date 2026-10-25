import { requireUserId } from "../middleware/auth.middleware";
import { type Request, type Response, type NextFunction } from "express";
import { Pool } from "pg";
import { loadEntitlements } from "../../entitlements/entitlements";

export class PremiumController {
  constructor(private readonly pool: Pool) {}

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const state=await loadEntitlements(this.pool,userId,new Date());
      res.setHeader("Cache-Control","no-store");
      res.json({data:{isPremium:state.isPremium,expiresAt:state.expiresAt}});
    } catch (error) {
      next(error);
    }
  };
}
