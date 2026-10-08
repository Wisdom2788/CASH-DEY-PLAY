import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();
  router.post("/telegram/login", (req, res, next) => {
    authController.login(req, res, next);
  });
  return router;
}
