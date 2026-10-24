import { type Request, type Response } from "express";
import { LoginStreakService } from "../../qualification/login-streak";
import { requireUserId } from "../middleware/auth.middleware";
import { readIdempotencyKey } from "../errors/http-errors";

export class LoginStreakController {
  constructor(private readonly loginStreakService: LoginStreakService) {}

  getProgress = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const state = await this.loginStreakService.getProgress(userId);
    res.status(200).json({ data: { state }, state });
  };

  recordLogin = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const result = await this.loginStreakService.processLogin(userId);
    res.status(200).json({ data: result, ...result });
  };

  claimBonus = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const idempotencyKey = readIdempotencyKey(req.header("Idempotency-Key"));
    const result = await this.loginStreakService.claimBonus(userId, idempotencyKey);
    res.status(200).json({ data: result, ...result });
  };
}
