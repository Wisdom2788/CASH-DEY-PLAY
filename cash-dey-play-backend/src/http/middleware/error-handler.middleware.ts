import { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import {
  BackdatedLoginError,
  InvalidLoginDateError,
  LoginStreakBonusAlreadyClaimedError,
  LoginStreakNotFoundError,
  LoginStreakNotYetQualifiedError,
} from "../../qualification/login-streak/login-streak.types";
import { InvalidEligibilityInputError } from "../../qualification/monthly-leaderboard/monthly-leaderboard.types";
import { InvalidCalendarMonthError } from "../../time/lagos-calendar-clock";
import { TelegramAuthError } from "../telegram/verify-telegram-init-data";
import { RateLimitExceededError } from "./rate-limit.middleware";
import { MissingIdempotencyKeyError } from "../errors/http-errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof TelegramAuthError) {
    res.status(401).json({ error: err.name, message: err.message, reason: err.reason });
    return;
  }

  if (err instanceof RateLimitExceededError) {
    res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(429).json({
      error: err.name,
      message: err.message,
      scope: err.scope,
      retryAfterSeconds: err.retryAfterSeconds,
    });
    return;
  }

  if (
    err instanceof InvalidLoginDateError ||
    err instanceof BackdatedLoginError ||
    err instanceof InvalidEligibilityInputError ||
    err instanceof InvalidCalendarMonthError ||
    err instanceof MissingIdempotencyKeyError
  ) {
    res.status(400).json({ error: err.name, message: err.message });
    return;
  }

  if (err instanceof LoginStreakNotFoundError) {
    res.status(404).json({ error: err.name, message: err.message, userId: err.userId });
    return;
  }

  if (err instanceof LoginStreakNotYetQualifiedError) {
    res.status(403).json({ error: err.name, message: err.message, state: err.state });
    return;
  }

  if (err instanceof LoginStreakBonusAlreadyClaimedError) {
    res.status(409).json({ error: err.name, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "ValidationError", details: err.issues });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "InternalServerError", message: "An expected error occured." });
}
