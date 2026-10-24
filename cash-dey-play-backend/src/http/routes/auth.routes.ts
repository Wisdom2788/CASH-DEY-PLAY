import { z } from "zod";
import { validateRequest } from "../middleware/validate-request.middleware";
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();
  router.post("/telegram/login", validateRequest(z.object({body:z.strictObject({initData:z.string().max(16384)}),query:z.strictObject({})})), (req, res, next) => {
    authController.login(req, res, next);
  });
  return router;
}
