import { type Request, type Response } from "express";
import { LoginStreakService } from "../../qualification/login-streak";
import { requireAuthenticatedUser } from "../middleware/auth.middleware";
import { readIdempotencyKey } from "../errors/http-errors";

export class LoginStreakController {
  constructor(private readonly loginStreakService: LoginStreakService) {}

  getProgress = async (req: Request, res: Response): Promise<void> => {
    const user = requireAuthenticatedUser(req);
    const state = await this.loginStreakService.getProgress(user.telegramUserId);
    res.status(200).json({ state });
  };

  recordLogin = async (req: Request, res: Response): Promise<void> => {
    const user = requireAuthenticatedUser(req);
    const result = await this.loginStreakService.processLogin(user.telegramUserId);
    res.status(200).json(result);
  };

  claimBonus = async (req: Request, res: Response): Promise<void> => {
    const user = requireAuthenticatedUser(req);
    const idempotencyKey = readIdempotencyKey(req.header("Idempotency-Key"));
    const result = await this.loginStreakService.claimBonus(user.telegramUserId, idempotencyKey);
    res.status(200).json(result);
  };
}
