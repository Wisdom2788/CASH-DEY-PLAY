import { type Pool } from "pg";
import { PostgresLoginStreakRepository, type ILoginStreakRepository } from "./repositories/login-streak.repository";
import { PostgresIdempotencyRepository, type IIdempotencyRepository } from "./repositories/idempotency.repository";
import { PostgresRewardAuditRepository, type IRewardAuditRepository } from "./repositories/reward-audit.repository";

export interface StreakRepositories {
  readonly streak: ILoginStreakRepository;
  readonly idempotency: IIdempotencyRepository;
  readonly audit: IRewardAuditRepository;
}

export interface StreakUnitOfWork {
  run<T>(userId: string, action: (repositories: StreakRepositories) => Promise<T>): Promise<T>;
}

/** One transaction and a per-user lock for both login and claim, across API instances. */
export class PostgresStreakUnitOfWork implements StreakUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(userId: string, action: (repositories: StreakRepositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Works before a user's first streak row exists. Released automatically on commit/rollback.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`streak:${userId}`]);
      const result = await action({
        streak: new PostgresLoginStreakRepository(client),
        idempotency: new PostgresIdempotencyRepository(client),
        audit: new PostgresRewardAuditRepository(client),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
