import { z } from "zod";
import { validateRequest } from "../middleware/validate-request.middleware";
import { Router } from "express";
import { TasksController } from "../controllers/tasks.controller";

export function createTasksRouter(tasksController: TasksController): Router {
  const router = Router();
  
  router.get("/state", validateRequest(z.object({query:z.strictObject({})})), tasksController.getState);
  router.post("/complete", tasksController.completeTask);
  router.post("/optional-video", tasksController.watchOptionalVideo);
  router.post("/skip-cooldown", tasksController.skipCooldown);

  return router;
}
