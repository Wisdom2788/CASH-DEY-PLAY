import { randomUUID } from "node:crypto";
import { PostgresStreakUnitOfWork } from "../streak-unit-of-work";
import { LoginStreakService } from "../../qualification/login-streak/login-streak.service";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PostgresLoginStreakRepository } from "./login-streak.repository";

/**
 * Real-database tests for the writes that must be atomic.
 * They run only when TEST_DATABASE_URL points at a throw-away Postgres, for example:
 *   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/cash_dey_play_test npx jest atomic-writes
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.REQUIRE_DB_TESTS === "true" && !databaseUrl) throw new Error("TEST_DATABASE_URL is required by this test run");
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("atomic writes on a real Postgres", () => {
  let pool: Pool;
  let admin: Pool;
  const schema = `cdp_test_${randomUUID().replace(/-/g, "")}`;
  let streakRepository: PostgresLoginStreakRepository;

  const USER_ID = "tg_9001";

  beforeAll(async () => {
    // These tests TRUNCATE tables. Refuse to run against anything that is not clearly a throw-away test database.
    const databaseName = new URL(databaseUrl as string).pathname.replace(/^\//, "");
    if (!/(?:^|_)test(?:_|$)/i.test(databaseName)) {
      throw new Error(
        `Refusing to run: TEST_DATABASE_URL must point to a database whose name contains "test" (got "${databaseName}"). These tests delete data.`,
      );
    }

    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    await pool.query(readFileSync(join(__dirname, "../../../prisma/migrations/0_init/migration.sql"), "utf8"));
    await pool.query(readFileSync(join(__dirname,"../../../prisma/migrations/2026102401_foundations/migration.sql"),"utf8"));
    streakRepository = new PostgresLoginStreakRepository(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE task_completions, login_streaks, reward_audit_events, idempotency_keys, users RESTART IDENTITY CASCADE");
    await pool.query(
      `INSERT INTO users (id, telegram_id, first_name) VALUES ($1, 9001, 'Test')`,
      [USER_ID],
    );
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
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
  describe("complete claim transactions", () => {
    const state = { windowStartDate: "2026-09-20", lastLoginDate: "2026-10-19", consecutiveLoginDaysCount: 30, graceDaysUsed: 0, hasClaimedBonus: false };
    const clock = { todayIsoCalendarDate: () => "2026-10-19" };

    it("replays the same key across independent service instances", async () => {
      await streakRepository.saveState(USER_ID, state);
      const services = Array.from({ length: 10 }, () => new LoginStreakService(clock, new PostgresStreakUnitOfWork(pool)));
      const results = await Promise.all(services.map(service => service.claimBonus(USER_ID, "same-key-1234")));
      expect(results.every(result => result.hasClaimedBonus)).toBe(true);
      expect((await pool.query("SELECT COUNT(*)::int AS count FROM reward_audit_events")).rows[0].count).toBe(1);
      expect((await pool.query("SELECT COUNT(*)::int AS count FROM idempotency_keys")).rows[0].count).toBe(1);
    });

    it("rolls back the flag when the audit insert fails, then allows a retry", async () => {
      await streakRepository.saveState(USER_ID, state);
      await pool.query(`CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END; $$`);
      await pool.query("CREATE TRIGGER reject_audit BEFORE INSERT ON reward_audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit()");
      const service = new LoginStreakService(clock, new PostgresStreakUnitOfWork(pool));
      try {
        await expect(service.claimBonus(USER_ID, "failure-key-1234")).rejects.toThrow("injected audit failure");
        expect((await streakRepository.getState(USER_ID))?.hasClaimedBonus).toBe(false);
        expect((await pool.query("SELECT COUNT(*)::int AS count FROM idempotency_keys")).rows[0].count).toBe(0);
      } finally {
        await pool.query("DROP TRIGGER reject_audit ON reward_audit_events");
        await pool.query("DROP FUNCTION reject_audit()");
      }
      await expect(service.claimBonus(USER_ID, "failure-key-1234")).resolves.toMatchObject({ hasClaimedBonus: true });
    });
  });

});
