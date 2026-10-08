import { type Redis } from "ioredis";
import { type NextFunction, type Request, type Response } from "express";

export class RateLimitExceededError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    public readonly scope: "user" | "ip",
  ) {
    super(`Rate limit exceeded for ${scope}. Retry after ${retryAfterSeconds} seconds.`);
    this.name = "RateLimitExceededError";
  }
}

export interface RateLimitCounterStore {
  increment(key: string, windowSeconds: number): Promise<number>;
}

const INCR_WITH_EXPIRE_LUA = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

export class RedisRateLimitCounterStore implements RateLimitCounterStore {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const count = await this.redis.eval(INCR_WITH_EXPIRE_LUA, 1, key, String(windowSeconds));
    return Number(count);
  }
}

export class MemoryRateLimitCounterStore implements RateLimitCounterStore {
  private readonly windows = new Map<string, { count: number; resetAtMs: number }>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const nowMs = Date.now();
    const existing = this.windows.get(key);
    if (existing === undefined || existing.resetAtMs <= nowMs) {
      this.windows.set(key, { count: 1, resetAtMs: nowMs + windowSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

export interface RateLimitMiddlewareOptions {
  readonly store: RateLimitCounterStore;
  readonly maxRequests: number;
  readonly windowSeconds: number;
  readonly scope: "user" | "ip";
}

function clientIpAddress(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject =
        options.scope === "user"
          ? req.auth?.telegramUserId
          : clientIpAddress(req);

      if (subject === undefined || subject.length === 0) {
        next();
        return;
      }

      const key = `rate-limit:${options.scope}:${subject}`;
      const count = await options.store.increment(key, options.windowSeconds);
      if (count > options.maxRequests) {
        throw new RateLimitExceededError(options.windowSeconds, options.scope);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
