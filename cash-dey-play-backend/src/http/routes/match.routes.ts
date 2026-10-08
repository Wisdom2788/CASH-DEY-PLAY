import { Router } from "express";
import { MatchController } from "../controllers/match.controller";

export function createMatchRouter(matchController: MatchController): Router {
  const router = Router();

  router.get("/recent-opponents", matchController.getRecentOpponents);
  router.post("/start", matchController.startMatch);
  router.post("/move", matchController.makeMove);
  router.post("/draw", matchController.drawCard);
  router.post("/forfeit", matchController.forfeit);

  return router;
}
