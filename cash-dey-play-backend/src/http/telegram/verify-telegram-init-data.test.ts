import {
  buildSignedTelegramInitData,
  TelegramAuthError,
  verifyTelegramInitData,
} from "./verify-telegram-init-data";

const BOT_TOKEN = "test-bot-token";

describe("verifyTelegramInitData", () => {
  const authDate = 1_783_516_800;
  const user = { id: 4242, first_name: "Chinedu", username: "chinedu" };

  it("accepts a correctly signed, unexpired payload", () => {
    const initData = buildSignedTelegramInitData({ botToken: BOT_TOKEN, user, authDate });
    const authenticated = verifyTelegramInitData(initData, BOT_TOKEN, authDate + 60);

    expect(authenticated.telegramUserId).toBe("4242");
    expect(authenticated.firstName).toBe("Chinedu");
    expect(authenticated.username).toBe("chinedu");
  });

  it("rejects a missing hash", () => {
    expect(() => verifyTelegramInitData("auth_date=1&user=%7B%7D", BOT_TOKEN)).toThrow(TelegramAuthError);
  });

  it("rejects a tampered payload", () => {
    const initData = buildSignedTelegramInitData({ botToken: BOT_TOKEN, user, authDate });
    expect(() => verifyTelegramInitData(`${initData}&extra=1`, BOT_TOKEN, authDate)).toThrow(TelegramAuthError);
  });

  it("rejects expired initData", () => {
    const initData = buildSignedTelegramInitData({ botToken: BOT_TOKEN, user, authDate });
    const twoDaysLater = authDate + 2 * 24 * 60 * 60;
    expect(() => verifyTelegramInitData(initData, BOT_TOKEN, twoDaysLater)).toThrow(TelegramAuthError);
  });
});
