import { STREAK_RULE_VERSION, StreakCycle, cycleEndExclusive, decideStreakLogin, milestoneWithinClaimWindow } from "./streak-policy";

const cycle = (lastCompletedDate: string, recoveryUsed = false): StreakCycle => ({
  ruleVersion: STREAK_RULE_VERSION, startDate: "2026-10-01", lastCompletedDate, recoveryUsed,
});

describe("approved stage08 calendar policy", () => {
  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9])("a miss after Day%i resets without grace", day => {
    const last = `2026-10-${String(day).padStart(2, "0")}`;
    const today = `2026-10-${String(day + 2).padStart(2, "0")}`;
    expect(decideStreakLogin(cycle(last), today)).toEqual({ kind: "RESET", day: 1 });
  });
  test("Day10 completed, missing11 and returning12 requires proof, not automatic forgiveness", () => {
    const previous = cycle("2026-10-10");
    expect(decideStreakLogin(previous, "2026-10-12")).toEqual({
      kind: "RECOVERY_REQUIRED", day: 12, missedDate: "2026-10-11",
      deadlineExclusive: "2026-10-13T00:00:00+01:00",
    });
    expect(previous.lastCompletedDate).toBe("2026-10-10");
    expect(previous.recoveryUsed).toBe(false);
  });
  test("two misses and an expired pending recovery reset", () => {
    expect(decideStreakLogin(cycle("2026-10-10"), "2026-10-13").kind).toBe("RESET");
  });
  test("only one recovery per cycle", () => {
    expect(decideStreakLogin(cycle("2026-10-12", true), "2026-10-14").kind).toBe("RESET");
    expect(decideStreakLogin(cycle("2026-10-12", true), "2026-10-13")).toEqual({ kind: "CONTINUE", day: 13 });
  });
  test("same-day evaluation is stable and next day continues", () => {
    expect(decideStreakLogin(cycle("2026-10-10"), "2026-10-10")).toEqual({ kind: "SAME_DAY", day: 10 });
    expect(decideStreakLogin(cycle("2026-10-10"), "2026-10-11")).toEqual({ kind: "CONTINUE", day: 11 });
  });
  test("cycle end is fixed, including recovery and missed Day30", () => {
    expect(cycleEndExclusive("2026-10-01")).toBe("2026-10-31T00:00:00+01:00");
    expect(decideStreakLogin(cycle("2026-10-30", true), "2026-10-31")).toEqual({ kind: "NEW_CYCLE", day: 1 });
    expect(decideStreakLogin(cycle("2026-10-29"), "2026-10-31")).toEqual({ kind: "NEW_CYCLE", day: 1 });
  });
  test("Lagos Day30 reward has only Day30 to claim; expiry is exclusive", () => {
    expect(milestoneWithinClaimWindow("2026-10-01", 30, new Date("2026-10-29T22:59:59.999Z"))).toBe(false);
    expect(milestoneWithinClaimWindow("2026-10-01", 30, new Date("2026-10-29T23:00:00Z"))).toBe(true);
    expect(milestoneWithinClaimWindow("2026-10-01", 10, new Date("2026-10-30T22:59:59.999Z"))).toBe(true);
    expect(milestoneWithinClaimWindow("2026-10-01", 10, new Date("2026-10-30T23:00:00Z"))).toBe(false);
  });
  test("month/year/leap boundaries use real dates", () => {
    expect(cycleEndExclusive("2028-02-01")).toBe("2028-03-02T00:00:00+01:00");
    expect(cycleEndExclusive("2026-12-20")).toBe("2027-01-19T00:00:00+01:00");
  });
  test("invalid, legacy, impossible and backdated states fail closed", () => {
    expect(() => cycleEndExclusive("2026-02-30")).toThrow("INVALID_LAGOS_DATE");
    expect(() => decideStreakLogin(cycle("2026-10-10"), "2026-10-09")).toThrow("BACKDATED_LOGIN");
    expect(() => decideStreakLogin(cycle("2026-10-09", true), "2026-10-10")).toThrow("INVALID_STREAK_STATE");
    expect(() => decideStreakLogin({ ...cycle("2026-10-10"), ruleVersion: "legacy" as typeof STREAK_RULE_VERSION }, "2026-10-11")).toThrow("UNSUPPORTED_STREAK_RULE");
  });
});
