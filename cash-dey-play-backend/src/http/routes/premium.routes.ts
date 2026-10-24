import { z } from "zod";
import { validateRequest } from "../middleware/validate-request.middleware";
import { Router } from "express";
import { PremiumController } from "../controllers/premium.controller";

export function createPremiumRouter(premiumController: PremiumController): Router {
  const router = Router();

  router.get("/status", validateRequest(z.object({query:z.strictObject({})})), premiumController.getStatus);

  return router;
}
