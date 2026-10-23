import { LoginStreakService } from "./login-streak.service";
import { type ILoginStreakRepository } from "../../db/repositories/login-streak.repository";
import { type IIdempotencyRepository } from "../../db/repositories/idempotency.repository";
import { type IRewardAuditRepository } from "../../db/repositories/reward-audit.repository";
import { type CalendarClock } from "../../time/lagos-calendar-clock";
import { LoginStreakBonusAlreadyClaimedError, type LoginStreakState } from "./login-streak.types";

/** Each call yields to the event loop, so two overlapping requests interleave the way real database round-trips do. */
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

class InMemoryLoginStreakRepository implements ILoginStreakRepository {
  constructor(private state: LoginStreakState | null) {}
  async getState(): Promise<LoginStreakState | null> {
    await tick();
    return this.state === null ? null : { ...this.state };
  }
  async saveState(_userId: string, state: LoginStreakState): Promise<void> {
    await tick();
    this.state = state;
  }
  /** Behaves like the database's conditional UPDATE: the check and the change happen together, so only one caller wins. */
  async tryMarkBonusClaimed(_userId: string, requiredConsecutiveDays: number): Promise<LoginStreakState | null> {
    await tick();
    if (
      this.state === null ||
      this.state.hasClaimedBonus ||
      this.state.consecutiveLoginDaysCount < requiredConsecutiveDays
    ) {
      return null;
    }
    this.state = { ...this.state, hasClaimedBonus: true };
    return { ...this.state };
  }
}

class InMemoryIdempotencyRepository implements IIdempotencyRepository {
  private readonly responses = new Map<string, unknown>();
  async find<T>(userId: string, endpoint: string, key: string): Promise<T | null> {
    await tick();
    return (this.responses.get(`${userId}|${endpoint}|${key}`) as T | undefined) ?? null;
  }
  async save(userId: string, endpoint: string, key: string, response: unknown): Promise<void> {
    await tick();
    this.responses.set(`${userId}|${endpoint}|${key}`, response);
  }
}

class RecordingRewardAuditRepository implements IRewardAuditRepository {
  readonly events: unknown[] = [];
  async append(event: unknown): Promise<void> {
    await tick();
    this.events.push(event);
  }
}

class FixedCalendarClock implements CalendarClock {
  todayIsoCalendarDate(): string {
    return "2026-07-30";
  }
}

const QUALIFIED_STATE: LoginStreakState = {
  windowStartDate: "2026-07-01",
  lastLoginDate: "2026-07-30",
  consecutiveLoginDaysCount: 30,
  graceDaysUsed: 0,
  hasClaimedBonus: false,
};

describe("LoginStreakService.claimBonus — a reward can be claimed only once, even under concurrency", () => {
  let audit: RecordingRewardAuditRepository;
  let service: LoginStreakService;

  beforeEach(() => {
    audit = new RecordingRewardAuditRepository();
    service = new LoginStreakService(
      new InMemoryLoginStreakRepository(QUALIFIED_STATE),
      new FixedCalendarClock(),
      audit,
      new InMemoryIdempotencyRepository(),
    );
  });

  it("records exactly one reward when the same request is retried sequentially with the same key", async () => {
    await service.claimBonus("user-1", "claim-key-0001");
    await service.claimBonus("user-1", "claim-key-0001");

    expect(audit.events).toHaveLength(1);
  });

  it("rejects a second sequential claim that uses a different key", async () => {
    await service.claimBonus("user-1", "claim-key-0001");

    await expect(service.claimBonus("user-1", "claim-key-0002")).rejects.toBeInstanceOf(
      LoginStreakBonusAlreadyClaimedError,
    );
    expect(audit.events).toHaveLength(1);
  });

  it("records exactly one reward when two claims with DIFFERENT keys arrive at the same time", async () => {
    const outcomes = await Promise.allSettled([
      service.claimBonus("user-1", "claim-key-0001"),
      service.claimBonus("user-1", "claim-key-0002"),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected") as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(LoginStreakBonusAlreadyClaimedError);
    expect(audit.events).toHaveLength(1);
  });

  it("records exactly one reward when the SAME key is sent twice at the same time", async () => {
    const outcomes = await Promise.allSettled([
      service.claimBonus("user-1", "claim-key-0001"),
      service.claimBonus("user-1", "claim-key-0001"),
    ]);

    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(audit.events).toHaveLength(1);
  });

  it("records exactly one reward when ten claims race", async () => {
    await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) => service.claimBonus("user-1", `claim-key-${String(index).padStart(4, "0")}`)),
    );

    expect(audit.events).toHaveLength(1);
  });
});
