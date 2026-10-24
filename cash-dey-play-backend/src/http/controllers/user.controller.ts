import { requireUserId } from "../middleware/auth.middleware";
import { type Request, type Response, type NextFunction } from "express";

import { UserRepository } from "../../db/repositories/user.repository";
import { NotImplementedFeatureError } from "../errors/http-errors";

export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const user = await this.userRepository.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new NotImplementedFeatureError("Updating the profile"));
  };
}
