import dotenv from "dotenv";

dotenv.config();

export type NodeEnvironment = "development" | "test" | "production";

export interface AppEnv {
  readonly nodeEnv: NodeEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly telegramBotToken: string;
  readonly jwtSecret: string;
  readonly corsOrigin: string;
  readonly allowDevAuthBypass: boolean;
  readonly userRequestsPerMinute: number;
  readonly ipRequestsPerMinute: number;
}

function readNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }
  return "development";
}

export function loadAppEnv(processEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = readNodeEnv(processEnv.NODE_ENV);
  const telegramBotToken = processEnv.TELEGRAM_BOT_TOKEN ?? "";
  const redisUrl = processEnv.REDIS_URL ?? "";
  const databaseUrl = processEnv.DATABASE_URL ?? "";

  if (nodeEnv === "production" && telegramBotToken.length === 0) {
    throw new Error("TELEGRAM_BOT_TOKEN is required in production.");
  }
  if (nodeEnv === "production" && redisUrl.length === 0) {
    throw new Error("REDIS_URL is required in production so rate limits stay process-safe.");
  }
  if (nodeEnv === "production" && databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required in production.");
  }

  const allowDevAuthBypass = processEnv.ALLOW_DEV_AUTH_BYPASS === "true" && nodeEnv !== "production";

  const jwtSecret = processEnv.JWT_SECRET ?? "dev_secret";

  return {
    nodeEnv,
    port: Number(processEnv.PORT ?? "3000"),
    databaseUrl,
    redisUrl,
    telegramBotToken,
    jwtSecret,
    corsOrigin: processEnv.CORS_ORIGIN ?? "http://localhost:5173",
    allowDevAuthBypass,
    userRequestsPerMinute: Number(processEnv.USER_REQUESTS_PER_MINUTE ?? "60"),
    ipRequestsPerMinute: Number(processEnv.IP_REQUESTS_PER_MINUTE ?? "120"),
  };
}
