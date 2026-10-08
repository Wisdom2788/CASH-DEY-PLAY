import { Router } from "express";
import { PremiumController } from "../controllers/premium.controller";

export function createPremiumRouter(premiumController: PremiumController): Router {
  const router = Router();

  router.get("/status", premiumController.getStatus);
  router.post("/subscribe", premiumController.subscribe);

  return router;
}
