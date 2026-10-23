import { type Pool } from "pg";
import { PostgresTasksRepository } from "./tasks.repository";

/**
 * Tiny stand-in for Postgres that honours the one rule that matters here:
 * UNIQUE (user_id, completed_on, task_key) — a duplicate INSERT ... ON CONFLICT DO NOTHING
 * affects zero rows. It also tallies every points increment so tests can assert on the total.
 */
class InMemoryPostgresLike {
  private readonly completions = new Set<string>();
  private readonly points = new Map<string, number>();

  readonly query = jest.fn(async (sql: string, params: unknown[] = []) => this.handle(sql, params));
  readonly connect = jest.fn(async () => ({ query: this.query, release: jest.fn() }));

  pointsFor(userId: string): number {
    return this.points.get(userId) ?? 0;
  }

  asPool(): Pool {
    return this as unknown as Pool;
  }

  private handle(sql: string, params: unknown[]): { rows: unknown[]; rowCount: number } {
    const text = sql.replace(/\s+/g, " ").trim();

    if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/^INSERT INTO task_completions/i.test(text)) {
      const [userId, completedOn, taskKey] = params as string[];
      const uniqueKey = `${userId}|${completedOn}|${taskKey}`;
      if (this.completions.has(uniqueKey)) {
        return { rows: [], rowCount: 0 };
      }
      this.completions.add(uniqueKey);
      return { rows: [{ id: this.completions.size }], rowCount: 1 };
    }

    const pointsUpdate = /^UPDATE users SET points = points \+ (\$(\d+)|\d+)/i.exec(text);
    if (pointsUpdate) {
      const increment =
        pointsUpdate[2] !== undefined ? Number(params[Number(pointsUpdate[2]) - 1]) : Number(pointsUpdate[1]);
      const idParam = /WHERE id = \$(\d+)/i.exec(text);
      const userId = String(params[idParam ? Number(idParam[1]) - 1 : 0]);
      this.points.set(userId, this.pointsFor(userId) + increment);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

const USER_ID = "tg_1001";
const TODAY = "2026-10-19";

describe("PostgresTasksRepository.completeTask — points are awarded once per task per day", () => {
  let database: InMemoryPostgresLike;
  let repository: PostgresTasksRepository;

  beforeEach(() => {
    database = new InMemoryPostgresLike();
    repository = new PostgresTasksRepository(database.asPool());
  });

  it("awards 50 points the first time a mandatory video task is completed", async () => {
    const result = await repository.completeTask(USER_ID, "task_login_video", TODAY);

    expect(result.pointsEarned).toBe(50);
    expect(database.pointsFor(USER_ID)).toBe(50);
  });

  it("awards nothing when the same task is completed a second time on the same day", async () => {
    await repository.completeTask(USER_ID, "task_login_video", TODAY);
    await repository.completeTask(USER_ID, "task_login_video", TODAY).catch(() => undefined);

    expect(database.pointsFor(USER_ID)).toBe(50);
  });

  it("awards points only once when the same task is submitted many times at once", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        repository.completeTask(USER_ID, "task_login_video", TODAY).catch(() => undefined),
      ),
    );

    expect(database.pointsFor(USER_ID)).toBe(50);
  });

  it("awards each different mandatory task once", async () => {
    await repository.completeTask(USER_ID, "task_login_video", TODAY);
    await repository.completeTask(USER_ID, "task_unlock_video", TODAY);

    expect(database.pointsFor(USER_ID)).toBe(100);
  });

  it("awards the same task again on the next day", async () => {
    await repository.completeTask(USER_ID, "task_login_video", TODAY);
    await repository.completeTask(USER_ID, "task_login_video", "2026-10-20");

    expect(database.pointsFor(USER_ID)).toBe(100);
  });

  it.each(["task_win_match", "task_all_complete", "not_a_real_task"])(
    "refuses to let the client complete %s directly",
    async (taskId) => {
      await expect(repository.completeTask(USER_ID, taskId, TODAY)).rejects.toThrow();
      expect(database.pointsFor(USER_ID)).toBe(0);
    },
  );
});
