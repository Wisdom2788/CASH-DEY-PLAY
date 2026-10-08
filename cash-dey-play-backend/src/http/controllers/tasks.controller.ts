import { type Request, type Response, type NextFunction } from "express";
import { TasksRepository } from "../../db/repositories/tasks.repository";

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

  completeTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const { taskId } = req.body;
      if (!taskId) {
        res.status(400).json({ message: "taskId is required" });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const result = await this.tasksRepo.completeTask(userId, taskId, today);
      res.json({ data: result, message: "Task completed!" });
    } catch (error) {
      next(error);
    }
  };

  watchOptionalVideo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const today = new Date().toISOString().slice(0, 10);
      const result = await this.tasksRepo.recordOptionalVideo(userId, today);
      if (!result.success) {
        res.status(400).json({ message: "Daily optional video cap (5/5) reached" });
        return;
      }
      res.json({ data: result, message: "Practice match unlocked!" });
    } catch (error) {
      next(error);
    }
  };

  skipCooldown = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement cooldown skip logic with Redis TTL
      res.json({ data: null, message: "Cooldown skipped!" });
    } catch (error) {
      next(error);
    }
  };

  recordMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const { isWin } = req.body;
      await this.tasksRepo.recordMatchResult(userId, isWin === true);
      res.json({ data: null, message: isWin ? "Victory recorded!" : "Match recorded" });
    } catch (error) {
      next(error);
    }
  };
}
