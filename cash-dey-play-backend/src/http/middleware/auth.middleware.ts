import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { type AuthState } from "../../db/repositories/user.repository";
import { ServiceUnavailableError } from "../errors/http-errors";
import { DEV_TELEGRAM_USER_ID_HEADER, TelegramAuthError, verifyTelegramInitData, type AuthenticatedTelegramUser } from "../telegram/verify-telegram-init-data";

declare global { namespace Express { interface Request { auth?: AuthenticatedTelegramUser; userId?: string; requestId?: string; } } }
export interface AuthMiddlewareOptions {
  readonly jwtSecret: string; readonly allowDevAuthBypass: boolean; readonly telegramBotToken?: string;
  readonly loadUser: (id: string) => Promise<AuthState | null>;
}
export function requireAuthenticatedUser(req: Request): AuthenticatedTelegramUser {
  if (!req.auth) throw new TelegramAuthError("authenticated user is missing");
  return req.auth;
}
export function requireUserId(req: Request): string {
  const user=requireAuthenticatedUser(req);
  if(req.userId !== `tg_${user.telegramUserId}`) throw new TelegramAuthError("canonical user identity is missing");
  return req.userId;
}
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const path=(req.originalUrl||req.path).split("?")[0];
      if(path === "/api/auth/telegram/login") { next(); return; }
      let tokenVersion: number | undefined;
      const header=req.header("Authorization");
      if(header?.startsWith("Bearer ")) {
        const decoded=jwt.verify(header.slice(7),options.jwtSecret,{algorithms:["HS256"],issuer:"cash-dey-play",audience:"cash-dey-play-mini-app"});
        if(typeof decoded === "string" || !Number.isSafeInteger(decoded.telegramId) || decoded.telegramId <= 0 || decoded.userId !== `tg_${decoded.telegramId}` ||
          (decoded.tokenVersion !== undefined && (!Number.isSafeInteger(decoded.tokenVersion) || decoded.tokenVersion < 0))) throw new TelegramAuthError("Invalid token claims");
        // Stage01 tokens did not include a version; they are valid only while the account version is still zero.
        tokenVersion=decoded.tokenVersion ?? 0;
        req.auth={telegramUserId:String(decoded.telegramId),firstName:"",username:null}; req.userId=decoded.userId;
      } else if(req.header("X-Telegram-Init-Data") && options.telegramBotToken) {
        req.auth=verifyTelegramInitData(req.header("X-Telegram-Init-Data")!,options.telegramBotToken);
        req.userId=`tg_${req.auth.telegramUserId}`;
      } else {
        const id=req.header(DEV_TELEGRAM_USER_ID_HEADER);
        if(!options.allowDevAuthBypass || !id || !/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new TelegramAuthError("Missing or invalid Authorization header");
        req.auth={telegramUserId:id,firstName:"Dev",username:"DevPlayer"}; req.userId=`tg_${id}`;
      }
      let state: AuthState | null;
      try { state=await options.loadUser(requireUserId(req)); } catch { throw new ServiceUnavailableError("Authentication is temporarily unavailable"); }
      if(!state || String(state.telegramId) !== req.auth.telegramUserId) throw new TelegramAuthError("Sign in before using this endpoint");
      if(tokenVersion !== undefined && state.tokenVersion !== tokenVersion) throw new TelegramAuthError("Session revoked; reopen the app in Telegram");
      next();
    } catch(error) {
      next(error instanceof TelegramAuthError || error instanceof ServiceUnavailableError ? error : new TelegramAuthError("Invalid token"));
    }
  };
}
