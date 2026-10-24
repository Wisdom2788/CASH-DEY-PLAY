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
    let startParam: string | null = null;

    if (this.allowDevAuthBypass && devUserId) {
      if (!/^[1-9]\d{0,15}$/.test(devUserId) || !Number.isSafeInteger(Number(devUserId))) throw new TelegramAuthError("Invalid developer user ID");
      telegramId = parseInt(devUserId, 10);
      firstName = "Dev";
      username = "DevPlayer";
    } else {
      if (!initData) {
        throw new TelegramAuthError("initData is required");
      }
      const tgUser = verifyTelegramInitData(initData, this.telegramBotToken);
      telegramId = parseInt(tgUser.telegramUserId, 10);
      firstName = tgUser.firstName;
      username = tgUser.username;
      avatarUrl = tgUser.photoUrl ?? null;
      startParam = tgUser.startParam ?? null;
    }

    const user = await this.userRepository.upsertTelegramUser(telegramId, firstName, username, avatarUrl, startParam);
    
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegramId, tokenVersion: user.tokenVersion },
      this.jwtSecret,
      { expiresIn: "24h", algorithm: "HS256", issuer: "cash-dey-play", audience: "cash-dey-play-mini-app" }
    );

    return { token, user };
  }
}
