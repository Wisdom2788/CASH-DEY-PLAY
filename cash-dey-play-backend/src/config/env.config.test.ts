import { loadAppEnv } from "./env.config";

const STRONG_JWT_SECRET = "x".repeat(40);

const completeProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  TELEGRAM_BOT_TOKEN: "bot-token",
  REDIS_URL: "redis://redis:6379",
  DATABASE_URL: "postgres://db/cashdeyplay",
  JWT_SECRET: STRONG_JWT_SECRET,
};

describe("loadAppEnv — JWT secret safety", () => {
  it("refuses to start in production when JWT_SECRET is missing", () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = completeProductionEnv;
    expect(() => loadAppEnv(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it("refuses the well-known development secret in production", () => {
    expect(() => loadAppEnv({ ...completeProductionEnv, JWT_SECRET: "dev_secret" })).toThrow(/JWT_SECRET/);
  });

  it("refuses a JWT_SECRET shorter than 32 characters in production", () => {
    expect(() => loadAppEnv({ ...completeProductionEnv, JWT_SECRET: "too-short" })).toThrow(/JWT_SECRET/);
  });

  it("accepts a JWT_SECRET of 32 or more characters in production", () => {
    expect(loadAppEnv(completeProductionEnv).jwtSecret).toBe(STRONG_JWT_SECRET);
  });

  it("still lets tests run without configuring a JWT_SECRET", () => {
    expect(() => loadAppEnv({ NODE_ENV: "test" })).not.toThrow();
  });
});

describe("loadAppEnv — unknown NODE_ENV must fail safe", () => {
  it("treats a missing NODE_ENV as production (and therefore demands production settings)", () => {
    expect(() => loadAppEnv({})).toThrow(/production/i);
  });

  it("treats a typo such as 'prod' as production", () => {
    expect(() => loadAppEnv({ NODE_ENV: "prod" })).toThrow(/production/i);
  });

  it("never enables the dev auth bypass when NODE_ENV is missing", () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = completeProductionEnv;
    const env = loadAppEnv({ ...withoutNodeEnv, ALLOW_DEV_AUTH_BYPASS: "true" });
    expect(env.nodeEnv).toBe("production");
    expect(env.allowDevAuthBypass).toBe(false);
  });

  it("never enables the dev auth bypass in production, even when the flag is set", () => {
    const env = loadAppEnv({ ...completeProductionEnv, ALLOW_DEV_AUTH_BYPASS: "true" });
    expect(env.allowDevAuthBypass).toBe(false);
  });

  it("enables the dev auth bypass only when NODE_ENV is explicitly development", () => {
    const env = loadAppEnv({ NODE_ENV: "development", ALLOW_DEV_AUTH_BYPASS: "true" });
    expect(env.allowDevAuthBypass).toBe(true);
  });

  it("does not enable a deployed test backdoor", () => {
    expect(loadAppEnv({ NODE_ENV: "test", ALLOW_DEV_AUTH_BYPASS: "true" }).allowDevAuthBypass).toBe(false);
  });
  it('keeps the realtime read gateway opt-in independently of development auth',()=>{
    expect(loadAppEnv({NODE_ENV:'test'}).realtimeReadEnabled).toBe(false);
    expect(loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'TRUE'}).realtimeReadEnabled).toBe(false);
    expect(loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'true'}).realtimeReadEnabled).toBe(true);
  });

  it('keeps moves separately gated and requires the read gateway before enabling them',()=>{
    expect(loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'true'}).realtimeMovesEnabled).toBe(false);
    expect(()=>loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_MOVES:'true'})).toThrow('requires ENABLE_REALTIME_READ');
    expect(loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'true',ENABLE_REALTIME_MOVES:'true'}).realtimeMovesEnabled).toBe(true);
  });

  it('keeps delivery gated and requires an explicit Redis channel plus read gateway',()=>{
    expect(loadAppEnv({NODE_ENV:'test'}).realtimeDeliveryEnabled).toBe(false);
    expect(()=>loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_DELIVERY:'true'})).toThrow('delivery requires');
    expect(()=>loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'true',ENABLE_REALTIME_DELIVERY:'true',REDIS_URL:'redis://localhost'})).toThrow('delivery requires');
    expect(loadAppEnv({NODE_ENV:'test',ENABLE_REALTIME_READ:'true',ENABLE_REALTIME_DELIVERY:'true',REDIS_URL:'redis://localhost',GAME_RELAY_CHANNEL:'cdp:test:game:v1'}).realtimeDeliveryEnabled).toBe(true);
  });

});
