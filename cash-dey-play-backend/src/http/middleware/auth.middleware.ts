import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import {
  DEV_TELEGRAM_USER_ID_HEADER,
  TelegramAuthError,
  type AuthenticatedTelegramUser,
} from "../telegram/verify-telegram-init-data";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedTelegramUser;
    }
  }
}

export interface AuthMiddlewareOptions {
  readonly jwtSecret: string;
  readonly allowDevAuthBypass: boolean;
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
      // Exclude /auth/telegram/login from auth middleware if added globally
      if (req.path === "/api/auth/telegram/login") {
        return next();
      }

      const devUserId = req.header(DEV_TELEGRAM_USER_ID_HEADER);
      if (options.allowDevAuthBypass && devUserId !== undefined && devUserId.length > 0) {
        req.auth = {
          telegramUserId: devUserId,
          firstName: "Dev",
          username: null,
        };
        return next();
      }

      const authHeader = req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new TelegramAuthError("Missing or invalid Authorization header");
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, options.jwtSecret) as { userId: string; telegramId: number };
      
      req.auth = {
        telegramUserId: decoded.telegramId.toString(),
        firstName: "", // Will be fetched from db if needed, or put into jwt
        username: null,
      };
      
      (req as any).userId = decoded.userId; // useful for repository queries
      
      next();
    } catch (error) {
      next(new TelegramAuthError("Invalid token"));
    }
  };
}
