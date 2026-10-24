import { type Request, type Response, type NextFunction } from "express";
import { TasksRepository } from "../../db/repositories/tasks.repository";
import { NotImplementedFeatureError } from "../errors/http-errors";

export class TasksController {
  constructor(private readonly tasksRepo: TasksRepository) {}

  getState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const today = new Date().toISOString().slice(0, 10);
      const state = await this.tasksRepo.getTasksState(userId, today);
      res.json({ data: state });
    } catch (error) {
      next(error);
    }
  };

  completeTask = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Verified video rewards"));
  };

  watchOptionalVideo = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Verified practice credits"));
  };

  skipCooldown = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Skipping the ranked cooldown"));
  };
}
