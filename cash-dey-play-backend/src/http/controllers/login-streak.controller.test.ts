import request from "supertest";
import { createApp } from "../../app";
import { LoginStreakService } from "../../qualification/login-streak";
import { MonthlyLeaderboardService } from "../../qualification/monthly-leaderboard";
import { MemoryRateLimitCounterStore } from "../middleware/rate-limit.middleware";
import { buildSignedTelegramInitData } from "../telegram/verify-telegram-init-data";
import {
  LoginStreakBonusAlreadyClaimedError,
  LoginStreakNotYetQualifiedError,
  type LoginStreakState,
  type RecordLoginResult,
} from "../../qualification/login-streak/login-streak.types";

const BOT_TOKEN = "controller-test-bot-token";
const AUTH_DATE = Math.floor(Date.now() / 1000);

function signedHeaders(): Record<string, string> {
  const initData = buildSignedTelegramInitData({
    botToken: BOT_TOKEN,
    user: { id: 9001, first_name: "Amaka" },
    authDate: AUTH_DATE,
  });
  return { "X-Telegram-Init-Data": initData };
}

describe("LoginStreakController", () => {
  let processLogin: jest.Mock;
  let claimBonus: jest.Mock;
  let getProgress: jest.Mock;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    processLogin = jest.fn();
    claimBonus = jest.fn();
    getProgress = jest.fn();

    const loginStreakService = {
      processLogin,
      claimBonus,
      getProgress,
    } as unknown as LoginStreakService;

    const monthlyLeaderboardService = {
      checkEligibility: jest.fn(),
    } as unknown as MonthlyLeaderboardService;

    app = createApp({
      authService: {} as any,
      pool: {} as any,
      userRepository: {} as any,
      tasksRepository: {} as any,
      walletRepository: {} as any,
      loginStreakService,
      monthlyLeaderboardService,
      telegramBotToken: BOT_TOKEN,
      jwtSecret: "test-secret",
      corsOrigin: "http://localhost:5173",
      allowDevAuthBypass: false,
      rateLimitStore: new MemoryRateLimitCounterStore(),
      userRequestsPerMinute: 60,
      ipRequestsPerMinute: 120,
    });
  });

  it("rejects requests without Telegram initData", async () => {
    const response = await request(app).post("/api/login-streak");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("TelegramAuthError");
  });

  it("records a login for the HMAC-verified Telegram user", async () => {
    const result: RecordLoginResult = {
      state: {
        windowStartDate: "2026-07-01",
        lastLoginDate: "2026-07-01",
        consecutiveLoginDaysCount: 1,
        graceDaysUsed: 0,
        hasClaimedBonus: false,
      },
      wasReset: false,
      graceDayConsumedToday: false,
      qualifiesForBonus: false,
    };
    processLogin.mockResolvedValue(result);

    const response = await request(app).post("/api/login-streak").set(signedHeaders());

    expect(response.status).toBe(200);
    expect(processLogin).toHaveBeenCalledWith("9001");
    expect(response.body.qualifiesForBonus).toBe(false);
  });

  it("rejects a claim that is missing an idempotency key", async () => {
    const response = await request(app).post("/api/login-streak/claim").set(signedHeaders());
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("MissingIdempotencyKeyError");
    expect(claimBonus).not.toHaveBeenCalled();
  });

  it("maps not-yet-qualified claims to 403 without re-testing engine math", async () => {
    const state: LoginStreakState = {
      windowStartDate: "2026-07-01",
      lastLoginDate: "2026-07-02",
      consecutiveLoginDaysCount: 2,
      graceDaysUsed: 0,
      hasClaimedBonus: false,
    };
    claimBonus.mockRejectedValue(new LoginStreakNotYetQualifiedError(state));

    const response = await request(app)
      .post("/api/login-streak/claim")
      .set({ ...signedHeaders(), "Idempotency-Key": "claim-key-1" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("LoginStreakNotYetQualifiedError");
  });

  it("maps an already-claimed bonus to 409", async () => {
    claimBonus.mockRejectedValue(new LoginStreakBonusAlreadyClaimedError());

    const response = await request(app)
      .post("/api/login-streak/claim")
      .set({ ...signedHeaders(), "Idempotency-Key": "claim-key-1" });

    expect(response.status).toBe(409);
  });

  it("returns current progress without recording a login", async () => {
    getProgress.mockResolvedValue(null);

    const response = await request(app).get("/api/login-streak").set(signedHeaders());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ state: null });
    expect(getProgress).toHaveBeenCalledWith("9001");
  });
});
