import { Router } from "express";
import { LeaderboardController } from "../controllers/leaderboard.controller";

export function createLeaderboardRouter(leaderboardController: LeaderboardController): Router {
  const router = Router();

  // These map to LEADERBOARD_GAME and LEADERBOARD_COMMUNITY constants in the frontend
  router.get("/game", leaderboardController.getGameLeaderboard);
  router.get("/community", leaderboardController.getCommunityLeaderboard);

  return router;
}
