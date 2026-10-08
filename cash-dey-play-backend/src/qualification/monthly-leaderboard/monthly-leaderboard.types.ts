/**
 * Business rule (confirmed with product owner):
 * - This track is calendar-month anchored (resets each real month), NOT a
 *   rolling personal window — distinct from login-streak.
 * - Eligibility requires completing at least 1 daily task on 20 DIFFERENT
 *   calendar days within that month — the days do NOT need to be
 *   consecutive, unlike the login streak.
 * - Eligibility also requires at least 15 match wins within that same month.
 * - There is NO grace day on this track. It is a hard count.
 *
 * This module deliberately does not know about streaks, grace days, or
 * resets — those are login-streak concerns. Keeping the two separate
 * (rather than forcing them through one shared "qualification engine")
 * reflects that they are genuinely different rules, not two views of the
 * same rule.
 */

export const MONTHLY_LEADERBOARD_REQUIRED_TASK_DAYS = 20;
export const MONTHLY_LEADERBOARD_REQUIRED_MATCH_WINS = 15;

export type IsoCalendarDate = string;

/** Raw activity counts for one user within one calendar month. */
export interface MonthlyLeaderboardEligibilityInput {
  readonly distinctTaskCompletionDays: number;
  readonly totalMatchWins: number;
}

export interface MonthlyLeaderboardEligibilityResult {
  readonly isEligible: boolean;
  readonly meetsTaskDayRequirement: boolean;
  readonly meetsMatchWinRequirement: boolean;
  readonly distinctTaskCompletionDays: number;
  readonly totalMatchWins: number;
}

export class InvalidEligibilityInputError extends Error {
  constructor(input: MonthlyLeaderboardEligibilityInput) {
    super(
      `Invalid eligibility input: distinctTaskCompletionDays and totalMatchWins must both be ` +
        `non-negative integers. Received: ${JSON.stringify(input)}.`,
    );
    this.name = "InvalidEligibilityInputError";
  }
}
