import jwt from "jsonwebtoken";
import { verifyTelegramInitData, TelegramAuthError } from "../http/telegram/verify-telegram-init-data";
import { UserRepository } from "../db/repositories/user.repository";
import { UserProfile } from "../types";

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly telegramBotToken: string,
    private readonly jwtSecret: string,
    private readonly allowDevAuthBypass: boolean
  ) {}

  async login(initData: string, devUserId?: string): Promise<{ token: string; user: UserProfile }> {
    let telegramId: number;
    let firstName: string;
    let username: string | null = null;
    let avatarUrl: string | null = null;

    if (this.allowDevAuthBypass && devUserId) {
      telegramId = parseInt(devUserId, 10);
      firstName = "Dev";
    } else {
      if (!initData) {
        throw new TelegramAuthError("initData is required");
      }
      const tgUser = verifyTelegramInitData(initData, this.telegramBotToken);
      telegramId = parseInt(tgUser.telegramUserId, 10);
      firstName = tgUser.firstName;
      username = tgUser.username;
      // You could extract photo_url if needed from initData
    }

    const user = await this.userRepository.upsertTelegramUser(telegramId, firstName, username, avatarUrl);
    
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegramId },
      this.jwtSecret,
      { expiresIn: "7d" }
    );

    return { token, user };
  }
}
