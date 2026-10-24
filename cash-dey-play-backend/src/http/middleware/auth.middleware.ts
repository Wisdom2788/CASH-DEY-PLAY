import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import {
  DEV_TELEGRAM_USER_ID_HEADER,
  TelegramAuthError,
  verifyTelegramInitData,
  type AuthenticatedTelegramUser,
} from "../telegram/verify-telegram-init-data";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedTelegramUser;
      userId?: string;
    }
  }
}

export interface AuthMiddlewareOptions {
  readonly jwtSecret: string;
  readonly allowDevAuthBypass: boolean;
  readonly telegramBotToken?: string;
}

export function requireAuthenticatedUser(req: Request): AuthenticatedTelegramUser {
  if (req.auth === undefined) {
    throw new TelegramAuthError("authenticated user is missing");
  }
  return req.auth;
}

export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // The sign-in endpoint is the only public route. Webhooks get their own verified route when built.
      const normalizedPath = (req.originalUrl || req.path || "").split("?")[0];
      if (normalizedPath === "/api/auth/telegram/login") {
        return next();
      }

      // 1. Check Bearer JWT token
      const authHeader = req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, options.jwtSecret, {
          algorithms: ["HS256"], issuer: "cash-dey-play", audience: "cash-dey-play-mini-app",
        });
        if (typeof decoded === "string" || !Number.isSafeInteger(decoded.telegramId) || decoded.telegramId <= 0 ||
            decoded.userId !== `tg_${decoded.telegramId}`) {
          throw new TelegramAuthError("Invalid token claims");
        }
        req.auth = {
          telegramUserId: decoded.telegramId.toString(),
          firstName: "",
          username: null,
        };
        req.userId = decoded.userId;
        return next();
      }

      // 2. Check X-Telegram-Init-Data (HMAC signature from Telegram)
      const initDataHeader = req.header("X-Telegram-Init-Data");
      if (initDataHeader && options.telegramBotToken) {
        const verified = verifyTelegramInitData(initDataHeader, options.telegramBotToken);
        req.auth = verified;
        req.userId = `tg_${verified.telegramUserId}`;
        return next();
      }

      // 3. Dev bypass
      const devUserId = req.header(DEV_TELEGRAM_USER_ID_HEADER);
      if (options.allowDevAuthBypass && devUserId !== undefined && devUserId.length > 0) {
        if (!/^[1-9]\d{0,15}$/.test(devUserId) || !Number.isSafeInteger(Number(devUserId))) {
          throw new TelegramAuthError("Invalid developer user ID");
        }
        req.auth = {
          telegramUserId: devUserId,
          firstName: "Dev",
          username: "DevPlayer",
        };
        req.userId = `tg_${devUserId}`;
        return next();
      }

      throw new TelegramAuthError("Missing or invalid Authorization header");
    } catch (error) {
      if (error instanceof TelegramAuthError) {
        return next(error);
      }
      return next(new TelegramAuthError("Invalid token"));
    }
  };
}
