import {
  isEligibleForMonthlyLeaderboard,
  countDistinctCalendarDays,
} from "./monthly-leaderboard-eligibility";
import { InvalidEligibilityInputError } from "./monthly-leaderboard.types";

describe("isEligibleForMonthlyLeaderboard", () => {
  it("is eligible at exactly the required task days and match wins", () => {
    const result = isEligibleForMonthlyLeaderboard({
      distinctTaskCompletionDays: 20,
      totalMatchWins: 15,
    });

    expect(result.isEligible).toBe(true);
    expect(result.meetsTaskDayRequirement).toBe(true);
    expect(result.meetsMatchWinRequirement).toBe(true);
  });

  it("is eligible when both requirements are comfortably exceeded", () => {
    const result = isEligibleForMonthlyLeaderboard({
      distinctTaskCompletionDays: 28,
      totalMatchWins: 40,
    });

    expect(result.isEligible).toBe(true);
  });

  it("is NOT eligible one task day short of the requirement", () => {
    const result = isEligibleForMonthlyLeaderboard({
      distinctTaskCompletionDays: 19,
      totalMatchWins: 15,
    });

    expect(result.isEligible).toBe(false);
    expect(result.meetsTaskDayRequirement).toBe(false);
    expect(result.meetsMatchWinRequirement).toBe(true);
  });

  it("is NOT eligible one match win short of the requirement", () => {
    const result = isEligibleForMonthlyLeaderboard({
      distinctTaskCompletionDays: 20,
      totalMatchWins: 14,
    });

    expect(result.isEligible).toBe(false);
    expect(result.meetsTaskDayRequirement).toBe(true);
    expect(result.meetsMatchWinRequirement).toBe(false);
  });

  it("is NOT eligible with zero activity", () => {
    const result = isEligibleForMonthlyLeaderboard({
      distinctTaskCompletionDays: 0,
      totalMatchWins: 0,
    });

    expect(result.isEligible).toBe(false);
  });

  it("rejects negative task-day counts as invalid input, not a false result", () => {
    expect(() =>
      isEligibleForMonthlyLeaderboard({ distinctTaskCompletionDays: -1, totalMatchWins: 15 }),
    ).toThrow(InvalidEligibilityInputError);
  });

  it("rejects negative match-win counts as invalid input, not a false result", () => {
    expect(() =>
      isEligibleForMonthlyLeaderboard({ distinctTaskCompletionDays: 20, totalMatchWins: -1 }),
    ).toThrow(InvalidEligibilityInputError);
  });

  it("rejects non-integer counts", () => {
    expect(() =>
      isEligibleForMonthlyLeaderboard({ distinctTaskCompletionDays: 20.5, totalMatchWins: 15 }),
    ).toThrow(InvalidEligibilityInputError);
  });
});

describe("countDistinctCalendarDays", () => {
  it("counts each unique date once", () => {
    const dates = ["2026-07-01", "2026-07-01", "2026-07-02", "2026-07-03"];
    expect(countDistinctCalendarDays(dates)).toBe(3);
  });

  it("returns 0 for an empty list", () => {
    expect(countDistinctCalendarDays([])).toBe(0);
  });

  it("does not require the dates to be in order — non-consecutive days count fine", () => {
    const dates = ["2026-07-28", "2026-07-03", "2026-07-15"];
    expect(countDistinctCalendarDays(dates)).toBe(3);
  });
});
