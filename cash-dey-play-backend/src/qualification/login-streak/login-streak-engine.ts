import {
  LOGIN_STREAK_WINDOW_LENGTH_DAYS,
  LOGIN_STREAK_MAX_GRACE_DAYS,
  InvalidLoginDateError,
  BackdatedLoginError,
  LoginStreakNotYetQualifiedError,
  LoginStreakBonusAlreadyClaimedError,
  type IsoCalendarDate,
  type LoginStreakState,
  type RecordLoginResult,
} from "./login-streak.types";

const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

function isValidIsoCalendarDate(dateString: string): boolean {
  if (!ISO_CALENDAR_DATE_PATTERN.test(dateString)) {
    return false;
  }
  const parsedDate = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }
  return parsedDate.toISOString().slice(0, 10) === dateString;
}

function calculateDaysBetween(earlierDate: IsoCalendarDate, laterDate: IsoCalendarDate): number {
  const earlierMs = new Date(`${earlierDate}T00:00:00.000Z`).getTime();
  const laterMs = new Date(`${laterDate}T00:00:00.000Z`).getTime();
  return Math.round((laterMs - earlierMs) / MILLISECONDS_PER_DAY);
}

function buildFreshStreakState(startDate: IsoCalendarDate): LoginStreakState {
  return {
    windowStartDate: startDate,
    lastLoginDate: startDate,
    consecutiveLoginDaysCount: 1,
    graceDaysUsed: 0,
    hasClaimedBonus: false,
  };
}

function buildResultFromState(
  state: LoginStreakState,
  wasReset: boolean,
  graceDayConsumedToday: boolean,
): RecordLoginResult {
  return {
    state,
    wasReset,
    graceDayConsumedToday,
    qualifiesForBonus: state.consecutiveLoginDaysCount >= LOGIN_STREAK_WINDOW_LENGTH_DAYS,
  };
}

/**
 * Records a login attempt against a user's existing streak state (or starts
 * a new one if `previousState` is null — i.e. this user has never logged in
 * before, or is starting a fresh window after a previous claim).
 *
 * This function is pure: same inputs always produce the same output, no
 * reads from a database or clock inside it. The caller is responsible for
 * loading `previousState` from storage before calling this, and persisting
 * `result.state` after — keeping all I/O at the edges and all the actual
 * business rule here, where it's cheap to test exhaustively.
 */
export function recordLogin(
  previousState: LoginStreakState | null,
  loginDate: IsoCalendarDate,
): RecordLoginResult {
  if (!isValidIsoCalendarDate(loginDate)) {
    throw new InvalidLoginDateError(loginDate);
  }

  if (previousState === null) {
    return buildResultFromState(buildFreshStreakState(loginDate), false, false);
  }

  const daysSinceLastLogin = calculateDaysBetween(previousState.lastLoginDate, loginDate);

  if (daysSinceLastLogin < 0) {
    throw new BackdatedLoginError(loginDate, previousState.lastLoginDate);
  }

  if (daysSinceLastLogin === 0) {
    // Same calendar day as the last recorded login — idempotent, no change.
    return buildResultFromState(previousState, false, false);
  }

  const missedDaysCount = daysSinceLastLogin - 1;

  if (missedDaysCount === 0) {
    // Consecutive calendar day — no miss, ordinary increment.
    const updatedState: LoginStreakState = {
      ...previousState,
      lastLoginDate: loginDate,
      consecutiveLoginDaysCount: previousState.consecutiveLoginDaysCount + 1,
    };
    return buildResultFromState(updatedState, false, false);
  }

  const graceStillAvailable = previousState.graceDaysUsed < LOGIN_STREAK_MAX_GRACE_DAYS;

  if (missedDaysCount === 1 && graceStillAvailable) {
    // Exactly one missed day, and the grace day hasn't been spent yet.
    const updatedState: LoginStreakState = {
      ...previousState,
      lastLoginDate: loginDate,
      consecutiveLoginDaysCount: previousState.consecutiveLoginDaysCount + 1,
      graceDaysUsed: previousState.graceDaysUsed + 1,
    };
    return buildResultFromState(updatedState, false, true);
  }

  // Either 2+ days were missed in one gap, or a single day was missed but
  // the one grace day for this window was already spent — reset forward
  // progress. Rewards already claimed before this point are untouched by
  // this reset; they live in the caller's payout records, not here.
  return buildResultFromState(buildFreshStreakState(loginDate), true, false);
}

/**
 * Marks the streak's bonus as claimed. Throws rather than silently no-op'ing
 * on either failure path (not yet qualified / already claimed) — a caller
 * that reaches this function without checking `qualifiesForBonus` first has
 * a bug, and a thrown error surfaces that immediately instead of quietly
 * awarding nothing.
 */
export function claimLoginStreakBonus(state: LoginStreakState): LoginStreakState {
  if (state.consecutiveLoginDaysCount < LOGIN_STREAK_WINDOW_LENGTH_DAYS) {
    throw new LoginStreakNotYetQualifiedError(state);
  }
  if (state.hasClaimedBonus) {
    throw new LoginStreakBonusAlreadyClaimedError();
  }
  return {
    ...state,
    hasClaimedBonus: true,
  };
}
