import { Router } from "express";
import { TasksController } from "../controllers/tasks.controller";

export function createTasksRouter(tasksController: TasksController): Router {
  const router = Router();
  
  router.get("/state", tasksController.getState);
  router.post("/complete", tasksController.completeTask);
  router.post("/optional-video", tasksController.watchOptionalVideo);
  router.post("/skip-cooldown", tasksController.skipCooldown);
  router.post("/record-match", tasksController.recordMatch);

  return router;
}
