import { type Pool } from "pg";
import { PostgresStreakUnitOfWork } from "./streak-unit-of-work";

describe("PostgresStreakUnitOfWork", () => {
  const release = jest.fn();
  const query = jest.fn();
  const connect = jest.fn(async () => ({ query, release }));
  const work = new PostgresStreakUnitOfWork({ connect } as unknown as Pool);

  beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({ rows: [], rowCount: 1 }); });

  it("writes claim, audit and idempotency using one client before committing", async () => {
    await work.run("tg_1", async ({ streak, audit, idempotency }) => {
      await streak.tryMarkBonusClaimed("tg_1", 30);
      await audit.append({ userId: "tg_1", eventType: "claim", amountKobo: null, reason: "test", triggeringRule: "test" });
      await idempotency.save("tg_1", "claim", "key-123456", {});
    });
    const statements = query.mock.calls.map(call => String(call[0]));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("pg_advisory_xact_lock");
    expect(statements[2]).toContain("UPDATE login_streaks");
    expect(statements[3]).toContain("INSERT INTO reward_audit_events");
    expect(statements[4]).toContain("INSERT INTO idempotency_keys");
    expect(statements[5]).toBe("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each(["audit", "idempotency"])("rolls back when %s persistence fails", async failure => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes(failure === "audit" ? "INSERT INTO reward_audit_events" : "INSERT INTO idempotency_keys")) {
        throw new Error("storage unavailable");
      }
      return { rows: [], rowCount: 1 };
    });
    await expect(work.run("tg_1", async ({ streak, audit, idempotency }) => {
      await streak.tryMarkBonusClaimed("tg_1", 30);
      await audit.append({ userId: "tg_1", eventType: "claim", amountKobo: null, reason: "test", triggeringRule: "test" });
      await idempotency.save("tg_1", "claim", "key-123456", {});
    })).rejects.toThrow("storage unavailable");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(query).not.toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });
});
