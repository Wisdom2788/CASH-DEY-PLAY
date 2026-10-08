import request from "supertest";
import { createApp } from "../../app";
import { LoginStreakService } from "../../qualification/login-streak";
import { MonthlyLeaderboardService } from "../../qualification/monthly-leaderboard";
import { MemoryRateLimitCounterStore } from "../middleware/rate-limit.middleware";
import { buildSignedTelegramInitData } from "../telegram/verify-telegram-init-data";

const BOT_TOKEN = "controller-test-bot-token";

describe("MonthlyLeaderboardController", () => {
  it("rejects a malformed month query before calling the service", async () => {
    const checkEligibility = jest.fn();
    const app = createApp({
      authService: {} as any,
      pool: {} as any,
      userRepository: {} as any,
      tasksRepository: {} as any,
      walletRepository: {} as any,
      loginStreakService: {} as LoginStreakService,
      monthlyLeaderboardService: { checkEligibility } as unknown as MonthlyLeaderboardService,
      telegramBotToken: BOT_TOKEN,
      jwtSecret: "test-secret",
      corsOrigin: "http://localhost:5173",
      allowDevAuthBypass: false,
      rateLimitStore: new MemoryRateLimitCounterStore(),
      userRequestsPerMinute: 60,
      ipRequestsPerMinute: 120,
    });

    const initData = buildSignedTelegramInitData({
      botToken: BOT_TOKEN,
      user: { id: 11, first_name: "Tayo" },
      authDate: Math.floor(Date.now() / 1000),
    });

    const response = await request(app)
      .get("/api/monthly-leaderboard/eligibility")
      .query({ month: "07-2026" })
      .set("X-Telegram-Init-Data", initData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ValidationError");
    expect(checkEligibility).not.toHaveBeenCalled();
  });

  it("returns eligibility for the authenticated user", async () => {
    const checkEligibility = jest.fn().mockResolvedValue({
      isEligible: false,
      meetsTaskDayRequirement: false,
      meetsMatchWinRequirement: true,
    });
    const app = createApp({
      authService: {} as any,
      pool: {} as any,
      userRepository: {} as any,
      tasksRepository: {} as any,
      walletRepository: {} as any,
      loginStreakService: {} as LoginStreakService,
      monthlyLeaderboardService: { checkEligibility } as unknown as MonthlyLeaderboardService,
      telegramBotToken: BOT_TOKEN,
      jwtSecret: "test-secret",
      corsOrigin: "http://localhost:5173",
      allowDevAuthBypass: false,
      rateLimitStore: new MemoryRateLimitCounterStore(),
      userRequestsPerMinute: 60,
      ipRequestsPerMinute: 120,
    });
    const initData = buildSignedTelegramInitData({
      botToken: BOT_TOKEN,
      user: { id: 11, first_name: "Tayo" },
      authDate: Math.floor(Date.now() / 1000),
    });

    const response = await request(app)
      .get("/api/monthly-leaderboard/eligibility")
      .query({ month: "2026-07" })
      .set("X-Telegram-Init-Data", initData);

    expect(response.status).toBe(200);
    expect(checkEligibility).toHaveBeenCalledWith("11", "2026-07");
    expect(response.body.meetsMatchWinRequirement).toBe(true);
  });
});
