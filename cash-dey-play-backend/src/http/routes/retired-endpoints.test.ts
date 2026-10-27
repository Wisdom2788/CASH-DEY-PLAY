import request from "supertest";
import { createApp } from "../../app";
import { MemoryRateLimitCounterStore, type RateLimitCounterStore } from "../middleware/rate-limit.middleware";
import { ServiceUnavailableError } from '../errors/http-errors';
import { buildSignedTelegramInitData } from "../telegram/verify-telegram-init-data";

const BOT_TOKEN = "retired-endpoints-test-bot-token";

function signedHeaders(): Record<string, string> {
  const initData = buildSignedTelegramInitData({
    botToken: BOT_TOKEN,
    user: { id: 4242, first_name: "Tolu" },
    authDate: Math.floor(Date.now() / 1000),
  });
  return { "X-Telegram-Init-Data": initData };
}

function buildTestApp(streakRewardsEnabled=false,mutationStore?:RateLimitCounterStore) {
  const poolQuery = jest.fn().mockResolvedValue({ rows: [{expires_at:null,ad_free:false}], rowCount: 1 });
  const recordMatchResult = jest.fn();
  const rateLimitStore=new MemoryRateLimitCounterStore();
  const app = createApp({
    streakRewardsEnabled,
    authService: {} as any,
    pool: { query: poolQuery } as any,
    userRepository: { findAuthState: async (id: string) => ({ telegramId: Number(id.slice(3)), tokenVersion: 0 }) } as any,
    tasksRepository: { recordMatchResult } as any,
    walletRepository: {} as any,
    loginStreakService: {} as any,
    monthlyLeaderboardService: {} as any,
    telegramBotToken: BOT_TOKEN,
    jwtSecret: "x".repeat(40),
    corsOrigin: "http://localhost:5173",
    allowDevAuthBypass: false,
    rateLimitStore,
    ...(mutationStore?{mutationRateLimitStore:mutationStore}:{}),
    userRequestsPerMinute: 60,
    ipRequestsPerMinute: 120,
  });
  return { app, poolQuery, recordMatchResult,rateLimitStore };
}

describe("endpoints that let the client grant itself rewards are retired", () => {
  it.each(['/api/streak/login','/API/STREAK/login'])('fails closed on shared-store loss for %s without using the read fallback',async path=>{
    const increment=jest.fn().mockRejectedValue(new ServiceUnavailableError('Shared store unavailable'));
    const {app,rateLimitStore,poolQuery}=buildTestApp(true,{increment});
    const general=jest.spyOn(rateLimitStore,'increment');
    expect((await request(app).post(path).set(signedHeaders()).send({})).status).toBe(503);
    expect(increment).toHaveBeenCalledTimes(1);expect(general).not.toHaveBeenCalled();expect(poolQuery).not.toHaveBeenCalled();
  });
  it('counts a streak mutation once in the user rate-limit window',async()=>{
    const {app,rateLimitStore}=buildTestApp();const increment=jest.spyOn(rateLimitStore,'increment');
    expect((await request(app).post('/api/streak/login').set(signedHeaders()).send({})).status).toBe(503);
    expect(increment).toHaveBeenCalledTimes(1);
  });
  it('retires the legacy automatic-grace reader/writers when versioned streaks are enabled',async()=>{
    const {app}=buildTestApp(true);
    expect((await request(app).get('/api/login-streak').set(signedHeaders())).status).toBe(410);
    expect((await request(app).post('/api/login-streak').set(signedHeaders()).send({})).status).toBe(410);
    expect((await request(app).post('/api/login-streak/claim').set(signedHeaders()).send({})).status).toBe(410);
  });
  it("POST /api/premium/subscribe no longer exists (premium must only come from a verified payment)", async () => {
    const { app, poolQuery } = buildTestApp();

    const response = await request(app).post("/api/premium/subscribe").set(signedHeaders()).send({});

    expect(response.status).toBe(404);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it("POST /api/tasks/record-match no longer exists (only the game server may record results)", async () => {
    const { app, recordMatchResult } = buildTestApp();

    const response = await request(app)
      .post("/api/tasks/record-match")
      .set(signedHeaders())
      .send({ isWin: true });

    expect(response.status).toBe(404);
    expect(recordMatchResult).not.toHaveBeenCalled();
  });

  it("keeps the read-only GET /api/premium/status endpoint", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/api/premium/status").set(signedHeaders());

    expect(response.status).toBe(200);
  });
});
