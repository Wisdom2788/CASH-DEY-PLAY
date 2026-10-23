import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PostgresLoginStreakRepository } from "./login-streak.repository";
import { PostgresTasksRepository } from "./tasks.repository";
import { TaskAlreadyCompletedError } from "./tasks.errors";

/**
 * Real-database tests for the writes that must be atomic.
 * They run only when TEST_DATABASE_URL points at a throw-away Postgres, for example:
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/cash_dey_play_test npx jest atomic-writes
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("atomic writes on a real Postgres", () => {
  let pool: Pool;
  let tasksRepository: PostgresTasksRepository;
  let streakRepository: PostgresLoginStreakRepository;

  const USER_ID = "tg_9001";
  const TODAY = "2026-10-20";

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(readFileSync(join(__dirname, "../schema.sql"), "utf8"));
    tasksRepository = new PostgresTasksRepository(pool);
    streakRepository = new PostgresLoginStreakRepository(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE task_completions, login_streaks, users RESTART IDENTITY CASCADE");
    await pool.query(
      `INSERT INTO users (id, telegram_id, first_name) VALUES ($1, 9001, 'Test')`,
      [USER_ID],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("task points", () => {
    it("awards 50 points once when ten identical requests arrive together", async () => {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 10 }, () => tasksRepository.completeTask(USER_ID, "task_login_video", TODAY)),
      );

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected") as PromiseRejectedResult[];
      expect(rejected).toHaveLength(9);
      rejected.forEach((outcome) => expect(outcome.reason).toBeInstanceOf(TaskAlreadyCompletedError));

      const user = await pool.query("SELECT points FROM users WHERE id = $1", [USER_ID]);
      expect(user.rows[0].points).toBe(50);
      const completions = await pool.query("SELECT COUNT(*)::int AS count FROM task_completions");
      expect(completions.rows[0].count).toBe(1);
    });

    it("leaves no completion behind when the player does not exist (the transaction rolls back)", async () => {
      await expect(tasksRepository.completeTask("tg_missing", "task_login_video", TODAY)).rejects.toThrow();

      const completions = await pool.query("SELECT COUNT(*)::int AS count FROM task_completions");
      expect(completions.rows[0].count).toBe(0);
    });
  });

  describe("streak bonus claim", () => {
    const qualified = {
      windowStartDate: "2026-09-20",
      lastLoginDate: "2026-10-19",
      consecutiveLoginDaysCount: 30,
      graceDaysUsed: 0,
      hasClaimedBonus: false,
    };

    it("lets exactly one of ten simultaneous claims win", async () => {
      await streakRepository.saveState(USER_ID, qualified);

      const results = await Promise.all(
        Array.from({ length: 10 }, () => streakRepository.tryMarkBonusClaimed(USER_ID, 30)),
      );

      expect(results.filter((state) => state !== null)).toHaveLength(1);
    });

    it("refuses to claim before 30 consecutive days", async () => {
      await streakRepository.saveState(USER_ID, { ...qualified, consecutiveLoginDaysCount: 29 });

      expect(await streakRepository.tryMarkBonusClaimed(USER_ID, 30)).toBeNull();
    });

    it("does not let a slow login (saved with the old, unclaimed state) un-claim the bonus in the same window", async () => {
      await streakRepository.saveState(USER_ID, qualified);
      await streakRepository.tryMarkBonusClaimed(USER_ID, 30);

      await streakRepository.saveState(USER_ID, { ...qualified, lastLoginDate: "2026-10-20", hasClaimedBonus: false });

      const state = await streakRepository.getState(USER_ID);
      expect(state?.hasClaimedBonus).toBe(true);
    });

    it("does reset the claimed flag when a genuinely new window starts", async () => {
      await streakRepository.saveState(USER_ID, qualified);
      await streakRepository.tryMarkBonusClaimed(USER_ID, 30);

      await streakRepository.saveState(USER_ID, {
        windowStartDate: "2026-10-20",
        lastLoginDate: "2026-10-20",
        consecutiveLoginDaysCount: 1,
        graceDaysUsed: 0,
        hasClaimedBonus: false,
      });

      const state = await streakRepository.getState(USER_ID);
      expect(state?.hasClaimedBonus).toBe(false);
    });
  });
});
