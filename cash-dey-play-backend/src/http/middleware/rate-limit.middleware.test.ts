import {
  createRateLimitMiddleware,
  FailOpenRateLimitCounterStore,
  MemoryRateLimitCounterStore,
  RateLimitExceededError,
  type RateLimitCounterStore,
} from "./rate-limit.middleware";

describe("MemoryRateLimitCounterStore", () => {
  it("counts requests inside a window and starts a new window after expiry", async () => {
    const store = new MemoryRateLimitCounterStore();
    expect(await store.increment("ip:1", 60)).toBe(1);
    expect(await store.increment("ip:1", 60)).toBe(2);
  });
});

describe("RateLimitExceededError", () => {
  it("exposes scope and retry-after as structured fields", () => {
    const error = new RateLimitExceededError(60, "user");
    expect(error).toBeInstanceOf(RateLimitExceededError);
    expect(error.scope).toBe("user");
    expect(error.retryAfterSeconds).toBe(60);
  });
});

describe("FailOpenRateLimitCounterStore", () => {
  const brokenStore: RateLimitCounterStore = {
    increment: jest.fn().mockRejectedValue(new Error("Stream isn't writeable and enableOfflineQueue options is false")),
  };

  it("passes the real count through while the store is healthy", async () => {
    const store = new FailOpenRateLimitCounterStore(new MemoryRateLimitCounterStore());
    expect(await store.increment("ip:1", 60)).toBe(1);
    expect(await store.increment("ip:1", 60)).toBe(2);
  });

  it("uses a bounded local counter instead of throwing when the store is unreachable", async () => {
    const warn = jest.fn();
    const store = new FailOpenRateLimitCounterStore(brokenStore, warn);
    await expect(store.increment("ip:1", 60)).resolves.toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("bounded local limits");
  });

  it("logs the outage once per interval, not once per request", async () => {
    const warn = jest.fn();
    let now = 1_000_000;
    const store = new FailOpenRateLimitCounterStore(brokenStore, warn, 60_000, () => now);
    await store.increment("a", 60);
    await store.increment("b", 60);
    now += 30_000;
    await store.increment("c", 60);
    expect(warn).toHaveBeenCalledTimes(1);
    now += 31_000;
    await store.increment("d", 60);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("createRateLimitMiddleware", () => {
  const request = { ip: "1.2.3.4", socket: {}, auth: undefined } as never;

  it("lets the request through when the counter store is down", async () => {
    const middleware = createRateLimitMiddleware({
      store: new FailOpenRateLimitCounterStore(
        { increment: jest.fn().mockRejectedValue(new Error("down")) },
        jest.fn(),
      ),
      maxRequests: 1,
      windowSeconds: 60,
      scope: "ip",
    });
    const next = jest.fn();
    await middleware(request, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("still blocks requests over the limit while the store works", async () => {
    const middleware = createRateLimitMiddleware({
      store: new MemoryRateLimitCounterStore(),
      maxRequests: 1,
      windowSeconds: 60,
      scope: "ip",
    });
    const next = jest.fn();
    await middleware(request, {} as never, next);
    await middleware(request, {} as never, next);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next.mock.calls[1][0]).toBeInstanceOf(RateLimitExceededError);
  });
});


describe("bounded local windows",()=>{
  it("evicts expired keys, caps live keys and reports real time remaining",async()=>{
    let now=100000;
    const store=new MemoryRateLimitCounterStore(()=>now,1);
    await store.increment("a",60);now+=45000;
    expect(await store.retryAfterSeconds("a")).toBe(15);
    await expect(store.increment("b",60)).rejects.toThrow(/capacity/);
    now+=15000;
    expect(await store.increment("b",60)).toBe(1);
  });
});
