import { type Request, type Response, type NextFunction } from "express";

import { UserRepository } from "../../db/repositories/user.repository";

export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
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

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // const userId = (req as any).userId;
      // For now, only username updates are supported
      const { username } = req.body;
      if (username) {
        // Would update in DB — placeholder for now
      }
      res.json({ data: { message: "Profile updated", status: 200 } });
    } catch (error) {
      next(error);
    }
  };
}
