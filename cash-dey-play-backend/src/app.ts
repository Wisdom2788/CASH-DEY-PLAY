import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { Pool } from "pg";
import Redis from "ioredis";

import { loadAppEnv, type NodeEnvironment } from "./config/env.config";
import { errorHandler } from "./http/middleware/error-handler.middleware";
import { createAuthMiddleware } from "./http/middleware/auth.middleware";
import {
  createRateLimitMiddleware,
  MemoryRateLimitCounterStore,
  RedisRateLimitCounterStore,
  type RateLimitCounterStore,
} from "./http/middleware/rate-limit.middleware";
import { createQualificationRouter } from "./http/routes/qualification.routes";

import { PostgresLoginStreakRepository } from "./db/repositories/login-streak.repository";
import { PostgresIdempotencyRepository } from "./db/repositories/idempotency.repository";
import { PostgresRewardAuditRepository } from "./db/repositories/reward-audit.repository";
import { LoginStreakService } from "./qualification/login-streak";
import { LoginStreakController } from "./http/controllers/login-streak.controller";

import { PostgresMonthlyLeaderboardRepository } from "./db/repositories/monthly-leaderboard.repository";
import { MonthlyLeaderboardService } from "./qualification/monthly-leaderboard";
import { MonthlyLeaderboardController } from "./http/controllers/monthly-leaderboard.controller";
import { LagosCalendarClock } from "./time/lagos-calendar-clock";

import { PostgresUserRepository } from "./db/repositories/user.repository";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./http/controllers/auth.controller";
import { createAuthRouter } from "./http/routes/auth.routes";

import { PostgresTasksRepository } from "./db/repositories/tasks.repository";
import { PostgresWalletRepository } from "./db/repositories/wallet.repository";
import { UserController } from "./http/controllers/user.controller";
import { TasksController } from "./http/controllers/tasks.controller";
import { WalletController } from "./http/controllers/wallet.controller";
import { MatchController } from "./http/controllers/match.controller";
import { PremiumController } from "./http/controllers/premium.controller";
import { LeaderboardController } from "./http/controllers/leaderboard.controller";

import { createUserRouter } from "./http/routes/user.routes";
import { createTasksRouter } from "./http/routes/tasks.routes";
import { createWalletRouter } from "./http/routes/wallet.routes";
import { createMatchRouter } from "./http/routes/match.routes";
import { createPremiumRouter } from "./http/routes/premium.routes";
import { createLeaderboardRouter } from "./http/routes/leaderboard.routes";

export interface AppDependencies {
  readonly pool: Pool;
  readonly authService: AuthService;
  readonly loginStreakService: LoginStreakService;
  readonly monthlyLeaderboardService: MonthlyLeaderboardService;
  readonly userRepository: PostgresUserRepository;
  readonly tasksRepository: PostgresTasksRepository;
  readonly walletRepository: PostgresWalletRepository;
  readonly telegramBotToken: string;
  readonly jwtSecret: string;
  readonly corsOrigin: string;
  readonly allowDevAuthBypass: boolean;
  readonly rateLimitStore: RateLimitCounterStore;
  readonly userRequestsPerMinute: number;
  readonly ipRequestsPerMinute: number;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: dependencies.corsOrigin,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key",
        "X-Telegram-Init-Data",
        "X-Dev-Telegram-User-Id",
      ],
    }),
  );
  app.use(express.json());

  app.use(
    createRateLimitMiddleware({
      store: dependencies.rateLimitStore,
      maxRequests: dependencies.ipRequestsPerMinute,
      windowSeconds: 60,
      scope: "ip",
    }),
  );
  app.use(
    createAuthMiddleware({
      jwtSecret: dependencies.jwtSecret,
      allowDevAuthBypass: dependencies.allowDevAuthBypass,
    }),
  );
  app.use(
    createRateLimitMiddleware({
      store: dependencies.rateLimitStore,
      maxRequests: dependencies.userRequestsPerMinute,
      windowSeconds: 60,
      scope: "user",
    }),
  );

  const authController = new AuthController(dependencies.authService);
  const loginStreakController = new LoginStreakController(dependencies.loginStreakService);
  const monthlyLeaderboardController = new MonthlyLeaderboardController(
    dependencies.monthlyLeaderboardService,
  );
  const userController = new UserController(dependencies.userRepository);
  const tasksController = new TasksController(dependencies.tasksRepository);
  const walletController = new WalletController(dependencies.walletRepository);
  const matchController = new MatchController(dependencies.pool);
  const premiumController = new PremiumController(dependencies.pool);
  const leaderboardController = new LeaderboardController(dependencies.pool);

  app.use("/api/auth", createAuthRouter(authController));
  app.use("/api/users", createUserRouter(userController));
  app.use("/api/tasks", createTasksRouter(tasksController));
  app.use("/api/wallet", createWalletRouter(walletController));
  app.use("/api/matches", createMatchRouter(matchController));
  app.use("/api/premium", createPremiumRouter(premiumController));
  app.use("/api/leaderboards", createLeaderboardRouter(leaderboardController));
  app.use("/api", createQualificationRouter(loginStreakController, monthlyLeaderboardController));
  app.use(errorHandler);

  return app;
}

function createRateLimitStore(redisUrl: string, nodeEnv: NodeEnvironment): RateLimitCounterStore {
  if (redisUrl.length === 0) {
    if (nodeEnv !== "production") {
      console.warn("REDIS_URL is not set; using process-local rate limits. Do not run more than one API instance.");
    }
    return new MemoryRateLimitCounterStore();
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(attempt) {
      if (attempt >= 2) {
        return null;
      }
      return 250;
    },
  });
  redis.on("error", (error: Error) => {
    console.warn(`Redis error: ${error.message}`);
  });
  return new RedisRateLimitCounterStore(redis);
}

function createProductionDependencies() {
  const env = loadAppEnv();
  const clock = new LagosCalendarClock();
  const pool = new Pool({ connectionString: env.databaseUrl.length > 0 ? env.databaseUrl : undefined });

  const rateLimitStore = createRateLimitStore(env.redisUrl, env.nodeEnv);

  const userRepository = new PostgresUserRepository(pool);
  const authService = new AuthService(
    userRepository,
    env.telegramBotToken,
    env.jwtSecret,
    env.allowDevAuthBypass
  );

  const loginStreakService = new LoginStreakService(
    new PostgresLoginStreakRepository(pool),
    clock,
    new PostgresRewardAuditRepository(pool),
    new PostgresIdempotencyRepository(pool),
  );
  const monthlyLeaderboardService = new MonthlyLeaderboardService(
    new PostgresMonthlyLeaderboardRepository(pool),
    clock,
  );

  const tasksRepository = new PostgresTasksRepository(pool);
  const walletRepository = new PostgresWalletRepository(pool);

  return {
    pool,
    authService,
    loginStreakService,
    monthlyLeaderboardService,
    userRepository,
    tasksRepository,
    walletRepository,
    telegramBotToken: env.telegramBotToken,
    jwtSecret: env.jwtSecret,
    corsOrigin: env.corsOrigin,
    allowDevAuthBypass: env.allowDevAuthBypass,
    rateLimitStore,
    userRequestsPerMinute: env.userRequestsPerMinute,
    ipRequestsPerMinute: env.ipRequestsPerMinute,
  };
}

if (require.main === module) {
  const env = loadAppEnv();
  const app = createApp(createProductionDependencies());
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
}
