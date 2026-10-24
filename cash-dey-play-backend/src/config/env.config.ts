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

const MINIMUM_PRODUCTION_JWT_SECRET_LENGTH = 32;
const PUBLIC_DEVELOPMENT_JWT_SECRET = "dev_secret";

/**
 * Fail safe: only an explicit "development" or "test" relaxes security.
 * A missing or mistyped NODE_ENV (for example "prod") is treated as production.
 */
function readNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === "development" || value === "test") {
    return value;
  }
  return "production";
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

  const configuredJwtSecret = processEnv.JWT_SECRET ?? "";
  if (nodeEnv === "production") {
    const isMissingOrWeak =
      configuredJwtSecret.length < MINIMUM_PRODUCTION_JWT_SECRET_LENGTH ||
      configuredJwtSecret === PUBLIC_DEVELOPMENT_JWT_SECRET;
    if (isMissingOrWeak) {
      throw new Error(
        `JWT_SECRET must be set to a random value of at least ${MINIMUM_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`,
      );
    }
  }

  const allowDevAuthBypass = processEnv.ALLOW_DEV_AUTH_BYPASS === "true" && nodeEnv === "development";

  const jwtSecret = configuredJwtSecret.length > 0 ? configuredJwtSecret : PUBLIC_DEVELOPMENT_JWT_SECRET;

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
