import request from "supertest";
import { createApp } from "../../app";
import { MemoryRateLimitCounterStore } from "../middleware/rate-limit.middleware";
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

function buildTestApp() {
  const poolQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const recordMatchResult = jest.fn();
  const app = createApp({
    authService: {} as any,
    pool: { query: poolQuery } as any,
    userRepository: {} as any,
    tasksRepository: { recordMatchResult } as any,
    walletRepository: {} as any,
    loginStreakService: {} as any,
    monthlyLeaderboardService: {} as any,
    telegramBotToken: BOT_TOKEN,
    jwtSecret: "x".repeat(40),
    corsOrigin: "http://localhost:5173",
    allowDevAuthBypass: false,
    rateLimitStore: new MemoryRateLimitCounterStore(),
    userRequestsPerMinute: 60,
    ipRequestsPerMinute: 120,
  });
  return { app, poolQuery, recordMatchResult };
}

describe("endpoints that let the client grant itself rewards are retired", () => {
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
