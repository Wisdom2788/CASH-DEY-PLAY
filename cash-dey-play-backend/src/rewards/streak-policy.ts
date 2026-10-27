/** Stage08 calendar policy only. No client input or ad callback may award from this module.
 * The future transactional consumer must bind verified ad evidence to user/cycle/missed
 * date, consume it once, and recheck SQL time while holding the user/cycle lock.
 */
export const STREAK_RULE_VERSION = "calendar-30-day10-ad-v1";
const DAY_MS = 86_400_000;

export interface StreakCycle {
  ruleVersion: typeof STREAK_RULE_VERSION;
  startDate: string;
  lastCompletedDate: string;
  recoveryUsed: boolean;
}

export type LoginDecision =
  | { kind: "SAME_DAY" | "CONTINUE"; day: number }
  | { kind: "RECOVERY_REQUIRED"; day: number; missedDate: string; deadlineExclusive: string }
  | { kind: "RESET" | "NEW_CYCLE"; day: 1 };

function ordinal(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_LAGOS_DATE");
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) {
    throw new Error("INVALID_LAGOS_DATE");
  }
  return parsed / DAY_MS;
}

function dateAt(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** End is exclusive Lagos midnight following calendar Day30. */
export function cycleEndExclusive(startDate: string): string {
  return `${dateAt(ordinal(startDate) + 30)}T00:00:00+01:00`;
}

function validateCycle(cycle: StreakCycle): { start: number; last: number } {
  if (cycle.ruleVersion !== STREAK_RULE_VERSION) throw new Error("UNSUPPORTED_STREAK_RULE");
  const start = ordinal(cycle.startDate);
  const last = ordinal(cycle.lastCompletedDate);
  if (last < start || last >= start + 30 || (cycle.recoveryUsed && last < start + 11)) {
    throw new Error("INVALID_STREAK_STATE");
  }
  return { start, last };
}

/** Dates must come from the server's Lagos clock. Pending recovery does not grant
 * a login day, milestone or ad-free benefit. Login/authentication itself stays available.
 */
export function decideStreakLogin(cycle: StreakCycle, today: string): LoginDecision {
  const { start, last } = validateCycle(cycle);
  const current = ordinal(today);
  if (current < last) throw new Error("BACKDATED_LOGIN");
  if (current >= start + 30) return { kind: "NEW_CYCLE", day: 1 };
  const day = current - start + 1;
  const gap = current - last;
  if (gap === 0) return { kind: "SAME_DAY", day };
  if (gap === 1) return { kind: "CONTINUE", day };
  if (gap === 2 && last - start + 1 >= 10 && !cycle.recoveryUsed) {
    return {
      kind: "RECOVERY_REQUIRED", day, missedDate: dateAt(last + 1),
      deadlineExclusive: `${dateAt(current + 1)}T00:00:00+01:00`,
    };
  }
  return { kind: "RESET", day: 1 };
}

/** Claim timing only; caller still verifies completed progress, tier, practice,
 * legacy reconciliation, once-only receipt and ledger transaction. No grace extension.
 */
export function milestoneWithinClaimWindow(
  startDate: string, milestone: 10 | 20 | 30, now: Date,
): boolean {
  if (![10, 20, 30].includes(milestone) || !Number.isFinite(now.getTime())) {
    throw new Error("INVALID_CLAIM_TIME");
  }
  const start = ordinal(startDate);
  const unlock = Date.parse(`${dateAt(start + milestone - 1)}T00:00:00+01:00`);
  return now.getTime() >= unlock && now.getTime() < Date.parse(cycleEndExclusive(startDate));
}
