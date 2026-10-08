import {
  MONTHLY_LEADERBOARD_REQUIRED_TASK_DAYS,
  MONTHLY_LEADERBOARD_REQUIRED_MATCH_WINS,
  InvalidEligibilityInputError,
  type MonthlyLeaderboardEligibilityInput,
  type MonthlyLeaderboardEligibilityResult,
  type IsoCalendarDate,
} from "./monthly-leaderboard.types";

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Pure eligibility check for the calendar-month leaderboard. Deliberately
 * takes pre-aggregated counts rather than raw activity rows — computing
 * "how many distinct days did this user complete a task in July" is a
 * database aggregation query, not domain logic; this function's job is only
 * to apply the business rule to numbers it's handed, which keeps it trivial
 * to unit test without spinning up a database.
 */
export function isEligibleForMonthlyLeaderboard(
  input: MonthlyLeaderboardEligibilityInput,
): MonthlyLeaderboardEligibilityResult {
  if (
    !isNonNegativeInteger(input.distinctTaskCompletionDays) ||
    !isNonNegativeInteger(input.totalMatchWins)
  ) {
    throw new InvalidEligibilityInputError(input);
  }

  const meetsTaskDayRequirement =
    input.distinctTaskCompletionDays >= MONTHLY_LEADERBOARD_REQUIRED_TASK_DAYS;
  const meetsMatchWinRequirement =
    input.totalMatchWins >= MONTHLY_LEADERBOARD_REQUIRED_MATCH_WINS;

  return {
    isEligible: meetsTaskDayRequirement && meetsMatchWinRequirement,
    meetsTaskDayRequirement,
    meetsMatchWinRequirement,
    distinctTaskCompletionDays: input.distinctTaskCompletionDays,
    totalMatchWins: input.totalMatchWins,
  };
}

/**
 * De-duplicates a list of calendar-date strings into a distinct-day count.
 * Order-independent by design — this track has no consecutiveness
 * requirement, unlike the login streak, so a Set is the right tool: it
 * only cares about uniqueness, never sequence.
 */
export function countDistinctCalendarDays(dates: readonly IsoCalendarDate[]): number {
  return new Set(dates).size;
}
