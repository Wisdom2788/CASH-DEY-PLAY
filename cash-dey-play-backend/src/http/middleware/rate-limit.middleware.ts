import { ServiceUnavailableError } from "../errors/http-errors";
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
  retryAfterSeconds?(key:string):Promise<number>;
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
  async retryAfterSeconds(key:string):Promise<number> { return Math.max(0,Math.ceil(await this.redis.pttl(key)/1000)); }
}

export class MemoryRateLimitCounterStore implements RateLimitCounterStore {
  private readonly windows=new Map<string,{count:number;resetAtMs:number}>();
  private sweptAt=0;
  constructor(private readonly nowMs:()=>number=()=>Date.now(),private readonly maxEntries=10000) {}
  async increment(key:string,windowSeconds:number):Promise<number> {
    const now=this.nowMs();
    if(now-this.sweptAt>=30000 || this.windows.size>=this.maxEntries) {
      for(const [name,value] of this.windows) if(value.resetAtMs<=now) this.windows.delete(name);
      this.sweptAt=now;
    }
    const current=this.windows.get(key);
    if(!current || current.resetAtMs<=now) {
      if(!current && this.windows.size>=this.maxEntries) throw new ServiceUnavailableError("Rate-limit capacity reached; retry shortly");
      this.windows.set(key,{count:1,resetAtMs:now+windowSeconds*1000});return 1;
    }
    return ++current.count;
  }
  async retryAfterSeconds(key:string):Promise<number> { return Math.max(0,Math.ceil(((this.windows.get(key)?.resetAtMs??0)-this.nowMs())/1000)); }
}

/** Degrade general traffic to bounded local limits; money routes must use the shared store directly. */
export class FailOpenRateLimitCounterStore implements RateLimitCounterStore {
  private readonly fallback=new MemoryRateLimitCounterStore();
  private lastWarningAtMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly inner: RateLimitCounterStore,
    private readonly warn: (message: string) => void = (message) => console.warn(message),
    private readonly warnEveryMs: number = 60_000,
    private readonly nowMs: () => number = () => Date.now(),
  ) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    try {
      return await this.inner.increment(key, windowSeconds);
    } catch (error) {
      const now = this.nowMs();
      if (now - this.lastWarningAtMs >= this.warnEveryMs) {
        this.lastWarningAtMs = now;
        const reason = error instanceof Error ? error.message : String(error);
        this.warn(`Rate limit store unavailable; using bounded local limits. Reason: ${reason}`);
      }
      return this.fallback.increment(key,windowSeconds);
    }
  }
  async retryAfterSeconds(key:string):Promise<number> {
    try {return this.inner.retryAfterSeconds ? await this.inner.retryAfterSeconds(key) : await this.fallback.retryAfterSeconds(key);}
    catch {return this.fallback.retryAfterSeconds(key);}
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
        const remaining=options.store.retryAfterSeconds ? await options.store.retryAfterSeconds(key) : options.windowSeconds;
        throw new RateLimitExceededError(Math.max(1,remaining), options.scope);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
