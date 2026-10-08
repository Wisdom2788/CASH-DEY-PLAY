import { Router } from "express";
import { LoginStreakController } from "../controllers/login-streak.controller";
import { MonthlyLeaderboardController, checkEligibilitySchema } from "../controllers/monthly-leaderboard.controller";
import { validateRequest } from "../middleware/validate-request.middleware";

export function createQualificationRouter(
  loginStreakController: LoginStreakController,
  monthlyLeaderboardController: MonthlyLeaderboardController,
): Router {
  const router = Router();

  router.get("/login-streak", loginStreakController.getProgress);
  router.post("/login-streak", loginStreakController.recordLogin);
  router.post("/login-streak/claim", loginStreakController.claimBonus);
  router.get(
    "/monthly-leaderboard/eligibility",
    validateRequest(checkEligibilitySchema),
    monthlyLeaderboardController.checkEligibility,
  );

  return router;
}
