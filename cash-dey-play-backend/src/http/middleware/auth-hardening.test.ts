import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../app";
import { MemoryRateLimitCounterStore } from "./rate-limit.middleware";
import { buildSignedTelegramInitData, verifyTelegramInitData } from "../telegram/verify-telegram-init-data";

const secret = "s".repeat(40);
function buildApp() {
  const debit = jest.fn(); const complete = jest.fn(); const optional = jest.fn();
  const app = createApp({ pool: { query: jest.fn().mockResolvedValue({ rows: [{expires_at:null,ad_free:false}] }) }, authService: {},
    userRepository: { findAuthState: async (id: string) => ({ telegramId: Number(id.slice(3)), tokenVersion: 0 }) }, tasksRepository: { completeTask: complete, recordOptionalVideo: optional },
    walletRepository: { debitWallet: debit }, loginStreakService: {}, monthlyLeaderboardService: {},
    telegramBotToken: "test-bot", jwtSecret: secret, corsOrigin: "http://localhost:5173", allowDevAuthBypass: false,
    rateLimitStore: new MemoryRateLimitCounterStore(), userRequestsPerMinute: 60, ipRequestsPerMinute: 1,
  } as unknown as Parameters<typeof createApp>[0]);
  return { app, debit, complete, optional };
}
const claims = { userId: "tg_4242", telegramId: 4242 };
const options = { issuer: "cash-dey-play", audience: "cash-dey-play-mini-app", expiresIn: 60 };

describe("API safety boundaries", () => {
  it("allows only expected algorithm, issuer, audience and internally consistent identity", async () => {
    const { app } = buildApp();
    const valid = jwt.sign(claims, secret, options);
    expect((await request(app).get("/api/premium/status").auth(valid, { type: "bearer" })).status).toBe(200);
    for (const token of [
      jwt.sign(claims, secret, { ...options, algorithm: "HS512" }),
      jwt.sign(claims, secret, { ...options, audience: "another-app" }),
      jwt.sign(claims, secret, { ...options, issuer: "another-issuer" }),
      jwt.sign({ ...claims, userId: "tg_999" }, secret, options),
      jwt.sign(claims, secret, { ...options, expiresIn: -1 }),
    ]) expect((await request(app).get("/api/premium/status").auth(token, { type: "bearer" })).status).toBe(401);
  });

  it("returns an unauthenticated health response without disclosing configuration", async () => {
    const { app } = buildApp();
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200); expect(response.body).toEqual({ ok: true });
  });

  it("does not combine signed-in players under the sign-in IP limit", async () => {
    const { app } = buildApp();
    for (const id of [4242, 4243]) {
      const token = jwt.sign({ userId: `tg_${id}`, telegramId: id }, secret, options);
      expect((await request(app).get("/api/premium/status").auth(token, { type: "bearer" })).status).toBe(200);
    }
  });

  it("cannot debit a wallet or grant unverified ad credits", async () => {
    const { app, debit, complete, optional } = buildApp();
    const token = jwt.sign(claims, secret, options);
    for (const endpoint of ["/api/wallet/redeem", "/api/tasks/complete", "/api/tasks/optional-video"]) {
      const response = await request(app).post(endpoint).auth(token, { type: "bearer" }).send({ amountNgn: 100, taskId: "task_login_video" });
      expect(response.status).toBe(501);
    }
    expect(debit).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled(); expect(optional).not.toHaveBeenCalled();
  });

  it("rejects future signed login dates beyond clock skew", () => {
    const initData = buildSignedTelegramInitData({ botToken: "test-bot", user: { id: 4242 }, authDate: 1061 });
    expect(() => verifyTelegramInitData(initData, "test-bot", 1000)).toThrow(/future/);
  });
});
