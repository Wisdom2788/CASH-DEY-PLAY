import { createHmac, timingSafeEqual } from "crypto";

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";
export const DEV_TELEGRAM_USER_ID_HEADER = "x-dev-telegram-user-id";
export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

export interface AuthenticatedTelegramUser {
  readonly telegramUserId: string;
  readonly firstName: string;
  readonly username: string | null;
}

export class TelegramAuthError extends Error {
  constructor(public readonly reason: string) {
    super(`Telegram authentication failed: ${reason}`);
    this.name = "TelegramAuthError";
  }
}

interface TelegramUserPayload {
  readonly id: number;
  readonly first_name?: string;
  readonly username?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  maxAgeSeconds: number = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
): AuthenticatedTelegramUser {
  if (initData.length === 0) {
    throw new TelegramAuthError("missing initData");
  }
  if (botToken.length === 0) {
    throw new TelegramAuthError("bot token is not configured");
  }

  const params = new URLSearchParams(initData);
  const providedHash = params.get("hash");
  if (providedHash === null) {
    throw new TelegramAuthError("hash is missing");
  }
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const providedBuffer = Buffer.from(providedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");
  if (providedBuffer.length !== computedBuffer.length || !timingSafeEqual(providedBuffer, computedBuffer)) {
    throw new TelegramAuthError("hash mismatch");
  }

  const authDateRaw = params.get("auth_date");
  if (authDateRaw === null) {
    throw new TelegramAuthError("auth_date is missing");
  }
  const authDate = Number(authDateRaw);
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw new TelegramAuthError("auth_date is invalid");
  }
  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError("initData has expired");
  }

  const userRaw = params.get("user");
  if (userRaw === null) {
    throw new TelegramAuthError("user payload is missing");
  }

  let userPayload: TelegramUserPayload;
  try {
    userPayload = JSON.parse(userRaw) as TelegramUserPayload;
  } catch {
    throw new TelegramAuthError("user payload is not valid JSON");
  }

  if (!Number.isInteger(userPayload.id)) {
    throw new TelegramAuthError("user id is missing");
  }

  return {
    telegramUserId: String(userPayload.id),
    firstName: userPayload.first_name ?? "",
    username: userPayload.username ?? null,
  };
}

export function buildSignedTelegramInitData(params: {
  botToken: string;
  user: TelegramUserPayload;
  authDate: number;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("auth_date", String(params.authDate));
  searchParams.set("query_id", "test-query");
  searchParams.set("user", JSON.stringify(params.user));

  const dataCheckString = [...searchParams.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(params.botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  searchParams.set("hash", hash);
  return searchParams.toString();
}
