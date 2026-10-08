import { Router } from "express";
import { UserController } from "../controllers/user.controller";


export function createUserRouter(userController: UserController): Router {
  const router = Router();
  // We use requireAuthenticatedUser in the middleware chain inside app.ts,
  // or we can just rely on the controller using the auth data.
  router.get("/me", userController.getProfile);
  router.post("/me", userController.updateProfile); // Using POST as per frontend implementation
  
  return router;
}
