import { type Request, type Response } from "express";
import { z } from "zod";
import { MonthlyLeaderboardService } from "../../qualification/monthly-leaderboard";
import { requireUserId } from "../middleware/auth.middleware";

export const checkEligibilitySchema = z.object({
  query: z.strictObject({
    month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM month format").optional(),
  }),
});

export class MonthlyLeaderboardController {
  constructor(private readonly monthlyLeaderboardService: MonthlyLeaderboardService) {}

  checkEligibility = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const monthQuery = req.query.month;
    const monthKey = typeof monthQuery === "string" ? monthQuery : undefined;
    const result = await this.monthlyLeaderboardService.checkEligibility(userId, monthKey);
    res.status(200).json({ data: result, ...result });
  };
}
