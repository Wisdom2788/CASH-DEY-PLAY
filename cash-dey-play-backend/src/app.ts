import { createServer } from "node:http";
import { attachRealtimeGateway } from "./realtime/gateway";
import { GameRepository } from "./game-engine/repository";
import { RealtimeSessionRepository } from "./realtime/session.repository";
import { randomUUID } from "node:crypto";
import { PRODUCT_RULES } from "./config/product-rules.config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { Pool } from "pg";
import Redis from "ioredis";

import { loadAppEnv, type NodeEnvironment } from "./config/env.config";
import { errorHandler } from "./http/middleware/error-handler.middleware";
import { createAuthMiddleware } from "./http/middleware/auth.middleware";
import { createRateLimitMiddleware, MemoryRateLimitCounterStore, RedisRateLimitCounterStore, type RateLimitCounterStore, FailOpenRateLimitCounterStore } from "./http/middleware/rate-limit.middleware";
import { createQualificationRouter } from "./http/routes/qualification.routes";

import { PostgresStreakUnitOfWork } from "./db/streak-unit-of-work";
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
  readonly trustProxyHops?: number;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.set("trust proxy", dependencies.trustProxyHops ?? 0);
  app.use((req,res,next) => { req.requestId=randomUUID(); res.setHeader("X-Request-Id",req.requestId); next(); });
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
  app.use(express.json({ limit: "32kb" }));

  app.get("/healthz", (_req, res) => { res.json({ ok: true }); });
  // Shared mobile-network addresses must not combine every authenticated player's limit.
  app.use("/api/auth/telegram/login",
    createRateLimitMiddleware({ store: dependencies.rateLimitStore,
      maxRequests: dependencies.ipRequestsPerMinute, windowSeconds: 60, scope: "ip" }),
  );
  app.use(
    createAuthMiddleware({
      jwtSecret: dependencies.jwtSecret,
      allowDevAuthBypass: dependencies.allowDevAuthBypass,
      telegramBotToken: dependencies.telegramBotToken,
      loadUser: (id) => dependencies.userRepository.findAuthState(id),
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

  app.get("/api/config/rules", (_req,res) => { res.setHeader("Cache-Control","private, max-age=300"); res.json({ data: PRODUCT_RULES }); });

  const authController = new AuthController(dependencies.authService);
  const loginStreakController = new LoginStreakController(dependencies.loginStreakService);
  const monthlyLeaderboardController = new MonthlyLeaderboardController(
    dependencies.monthlyLeaderboardService,
  );
  const userController = new UserController(dependencies.userRepository,dependencies.pool);
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
  // Backward-compatible aliases for qualification leaderboard endpoints
  app.get("/api/qualification/monthly-leaderboard", leaderboardController.getGameLeaderboard);
  app.get("/api/qualification/community-leaderboard", leaderboardController.getCommunityLeaderboard);
  app.use("/api", createQualificationRouter(loginStreakController, monthlyLeaderboardController));
  app.use(errorHandler);

  return app;
}

const REDIS_READY_TIMEOUT_MS = 10_000;

interface RateLimitSetup {
  readonly store: RateLimitCounterStore;
  readonly mutationStore: RateLimitCounterStore;
  /** Resolves when the store can be used (or after a timeout, so a bad Redis address cannot stop the API starting). */
  readonly whenReady: Promise<void>;
}

function createRateLimitStore(redisUrl: string, nodeEnv: NodeEnvironment): RateLimitSetup {
  if (redisUrl.length === 0) {
    if (nodeEnv !== "production") {
      console.warn("REDIS_URL is not set; using process-local rate limits. Do not run more than one API instance.");
    }
    const store=new MemoryRateLimitCounterStore();
    return {store,mutationStore:store,whenReady:Promise.resolve()};
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Keep reconnecting forever with a short, growing delay. (Giving up after two tries left every later request failing.)
    retryStrategy(attempt) {
      return Math.min(attempt * 200, 3_000);
    },
  });
  redis.on("error", (error: Error) => {
    console.warn(`Redis error: ${error.message}`);
  });

  const whenReady = new Promise<void>((resolve) => {
    if (redis.status === "ready") {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      console.error(
        `Redis was not ready after ${REDIS_READY_TIMEOUT_MS} ms. Rate limits are process-local until it connects. Check REDIS_URL (use the Internal URL, same region).`,
      );
      resolve();
    }, REDIS_READY_TIMEOUT_MS);
    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  const mutationStore=new RedisRateLimitCounterStore(redis);
  return { store: new FailOpenRateLimitCounterStore(mutationStore), mutationStore, whenReady };
}

function createProductionDependencies() {
  const env = loadAppEnv();
  const clock = new LagosCalendarClock();
  const pool = new Pool({ connectionString: env.databaseUrl.length > 0 ? env.databaseUrl : undefined });

  const rateLimit = createRateLimitStore(env.redisUrl, env.nodeEnv);

  const userRepository = new PostgresUserRepository(pool);
  const authService = new AuthService(
    userRepository,
    env.telegramBotToken,
    env.jwtSecret,
    env.allowDevAuthBypass
  );

  const loginStreakService = new LoginStreakService(
    clock,
    new PostgresStreakUnitOfWork(pool),
  );
  const monthlyLeaderboardService = new MonthlyLeaderboardService(
    new PostgresMonthlyLeaderboardRepository(pool),
    clock,
  );

  const tasksRepository = new PostgresTasksRepository(pool);
  const walletRepository = new PostgresWalletRepository(pool);

  const dependencies = {
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
    rateLimitStore: rateLimit.store,
    userRequestsPerMinute: env.userRequestsPerMinute,
    ipRequestsPerMinute: env.ipRequestsPerMinute,
    trustProxyHops: env.trustProxyHops,
  };

  return { dependencies, rateLimitReady: rateLimit.whenReady,mutationRateLimits:rateLimit.mutationStore };
}

if (require.main === module) {
  const env = loadAppEnv();
  const { dependencies, rateLimitReady,mutationRateLimits } = createProductionDependencies();
  const app = createApp(dependencies);
  // Do not accept traffic until the rate-limit store is connected (or the wait timed out and said so in the logs).
  void rateLimitReady.then(() => {
    const server=createServer(app);
    if(env.realtimeReadEnabled)attachRealtimeGateway(server,{jwtSecret:dependencies.jwtSecret,origin:dependencies.corsOrigin,
      rateLimits:dependencies.rateLimitStore,sessions:new RealtimeSessionRepository(dependencies.pool),
      ...(env.realtimeMovesEnabled?{actions:{games:new GameRepository(dependencies.pool),rateLimits:mutationRateLimits}}:{})});
    server.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
    });
  });
}
