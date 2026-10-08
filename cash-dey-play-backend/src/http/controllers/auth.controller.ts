import { type Request, type Response, type NextFunction } from "express";
import { AuthService } from "../../auth/auth.service";
import { TelegramAuthError, DEV_TELEGRAM_USER_ID_HEADER } from "../telegram/verify-telegram-init-data";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { initData } = req.body;
      const devUserId = req.header(DEV_TELEGRAM_USER_ID_HEADER) as string | undefined;

      const result = await this.authService.login(initData, devUserId);
      
      res.json({ data: result });
    } catch (error) {
      if (error instanceof TelegramAuthError) {
        res.status(401).json({ message: "Invalid Telegram authentication" });
        return;
      }
      next(error);
    }
  }
}
