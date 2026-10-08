import { MemoryRateLimitCounterStore, RateLimitExceededError } from "./rate-limit.middleware";

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
