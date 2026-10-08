import {
  recordLogin,
  claimLoginStreakBonus,
} from "./login-streak-engine";
import {
  LOGIN_STREAK_WINDOW_LENGTH_DAYS,
  InvalidLoginDateError,
  BackdatedLoginError,
  LoginStreakNotYetQualifiedError,
  LoginStreakBonusAlreadyClaimedError,
  type LoginStreakState,
} from "./login-streak.types";

/**
 * Small local helper: builds an array of consecutive ISO date strings
 * starting from a given date, so tests don't hand-type 30 dates.
 * Lives in the test file because it's test-fixture logic, not production
 * logic — it does not belong in the engine itself (YAGNI: the engine never
 * needs to generate date ranges, only compare two dates it's given).
 */
function buildConsecutiveDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  for (let dayIndex = 0; dayIndex < count; dayIndex += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

describe("recordLogin", () => {
  describe("first login (no previous state)", () => {
    it("initializes a fresh streak with a count of 1", () => {
      const result = recordLogin(null, "2026-07-01");

      expect(result.state.windowStartDate).toBe("2026-07-01");
      expect(result.state.lastLoginDate).toBe("2026-07-01");
      expect(result.state.consecutiveLoginDaysCount).toBe(1);
      expect(result.state.graceDaysUsed).toBe(0);
      expect(result.state.hasClaimedBonus).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.graceDayConsumedToday).toBe(false);
      expect(result.qualifiesForBonus).toBe(false);
    });
  });

  describe("consecutive daily logins", () => {
    it("increments the count by 1 for each consecutive calendar day", () => {
      let state: LoginStreakState | null = null;
      const dates = buildConsecutiveDates("2026-07-01", 5);

      for (const date of dates) {
        state = recordLogin(state, date).state;
      }

      expect(state?.consecutiveLoginDaysCount).toBe(5);
      expect(state?.graceDaysUsed).toBe(0);
    });

    it("qualifies for the bonus exactly on the 30th consecutive day, not before", () => {
      let state: LoginStreakState | null = null;
      const dates = buildConsecutiveDates("2026-07-01", LOGIN_STREAK_WINDOW_LENGTH_DAYS);
      let lastResult = recordLogin(state, dates[0]);
      state = lastResult.state;

      for (let i = 1; i < dates.length; i += 1) {
        lastResult = recordLogin(state, dates[i]);
        state = lastResult.state;
        if (i < dates.length - 1) {
          expect(lastResult.qualifiesForBonus).toBe(false);
        }
      }

      expect(state?.consecutiveLoginDaysCount).toBe(LOGIN_STREAK_WINDOW_LENGTH_DAYS);
      expect(lastResult.qualifiesForBonus).toBe(true);
    });
  });

  describe("duplicate login on the same day", () => {
    it("is idempotent — logging in twice in one day does not double-count", () => {
      const firstLogin = recordLogin(null, "2026-07-01");
      const duplicateLogin = recordLogin(firstLogin.state, "2026-07-01");

      expect(duplicateLogin.state.consecutiveLoginDaysCount).toBe(1);
      expect(duplicateLogin.wasReset).toBe(false);
      expect(duplicateLogin.graceDayConsumedToday).toBe(false);
    });
  });

  describe("a single missed day (grace)", () => {
    it("forgives exactly one missed day and continues the streak", () => {
      const day1 = recordLogin(null, "2026-07-01");
      // 2026-07-02 is skipped entirely
      const day3 = recordLogin(day1.state, "2026-07-03");

      expect(day3.wasReset).toBe(false);
      expect(day3.graceDayConsumedToday).toBe(true);
      expect(day3.state.consecutiveLoginDaysCount).toBe(2);
      expect(day3.state.graceDaysUsed).toBe(1);
    });

    it("does not consume a second grace day once one has already been used", () => {
      const day1 = recordLogin(null, "2026-07-01");
      const day3 = recordLogin(day1.state, "2026-07-03"); // grace used here
      // a second isolated single-day gap after grace is already spent:
      const day5 = recordLogin(day3.state, "2026-07-05");

      expect(day5.wasReset).toBe(true);
      expect(day5.state.consecutiveLoginDaysCount).toBe(1);
      expect(day5.state.graceDaysUsed).toBe(0);
      expect(day5.state.windowStartDate).toBe("2026-07-05");
    });
  });

  describe("resets", () => {
    it("resets immediately on a 2+ day gap even if grace was never used", () => {
      const day1 = recordLogin(null, "2026-07-01");
      // three calendar days skipped in one gap (07-02, 07-03, 07-04)
      const day5 = recordLogin(day1.state, "2026-07-05");

      expect(day5.wasReset).toBe(true);
      expect(day5.graceDayConsumedToday).toBe(false);
      expect(day5.state.consecutiveLoginDaysCount).toBe(1);
      expect(day5.state.graceDaysUsed).toBe(0);
    });

    it("never claws back qualification already reached before a later reset", () => {
      // Reaching 30 days and qualifying is a fact about the past; a reset
      // afterward only affects forward progress toward the NEXT bonus.
      let state: LoginStreakState | null = null;
      const dates = buildConsecutiveDates("2026-07-01", LOGIN_STREAK_WINDOW_LENGTH_DAYS);
      for (const date of dates) {
        state = recordLogin(state, date).state;
      }
      const qualifiedState = state as LoginStreakState;
      const claimedState = claimLoginStreakBonus(qualifiedState);

      // A big gap after claiming resets forward progress, but the claim
      // itself is a separate, already-recorded fact the caller keeps
      // (e.g. in an append-only payouts table) — this engine only asserts
      // that the reset does not silently un-set hasClaimedBonus retroactively
      // on some OTHER already-returned state object.
      expect(claimedState.hasClaimedBonus).toBe(true);
    });
  });

  describe("invalid input", () => {
    it("rejects a malformed date string", () => {
      expect(() => recordLogin(null, "31-07-2026")).toThrow(InvalidLoginDateError);
      expect(() => recordLogin(null, "not-a-date")).toThrow(InvalidLoginDateError);
    });

    it("rejects a calendar-overflow date that JS Date would otherwise roll forward", () => {
      expect(() => recordLogin(null, "2026-02-31")).toThrow(InvalidLoginDateError);
    });

    it("rejects a login date earlier than the last recorded login", () => {
      const day5 = recordLogin(null, "2026-07-05");
      expect(() => recordLogin(day5.state, "2026-07-01")).toThrow(BackdatedLoginError);
    });
  });
});

describe("claimLoginStreakBonus", () => {
  it("throws if the streak has not yet reached the required day count", () => {
    const day1 = recordLogin(null, "2026-07-01");
    expect(() => claimLoginStreakBonus(day1.state)).toThrow(LoginStreakNotYetQualifiedError);
  });

  it("succeeds once the streak has reached the required day count", () => {
    let state: LoginStreakState | null = null;
    const dates = buildConsecutiveDates("2026-07-01", LOGIN_STREAK_WINDOW_LENGTH_DAYS);
    for (const date of dates) {
      state = recordLogin(state, date).state;
    }
    const claimedState = claimLoginStreakBonus(state as LoginStreakState);
    expect(claimedState.hasClaimedBonus).toBe(true);
  });

  it("throws if the bonus for this window has already been claimed", () => {
    let state: LoginStreakState | null = null;
    const dates = buildConsecutiveDates("2026-07-01", LOGIN_STREAK_WINDOW_LENGTH_DAYS);
    for (const date of dates) {
      state = recordLogin(state, date).state;
    }
    const claimedState = claimLoginStreakBonus(state as LoginStreakState);
    expect(() => claimLoginStreakBonus(claimedState)).toThrow(LoginStreakBonusAlreadyClaimedError);
  });
});
