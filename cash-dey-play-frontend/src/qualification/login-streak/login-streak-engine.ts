/**
 * Login Streak Qualification Engine
 *
 * Business Rules:
 * - Personal, per-user rolling window of 30 days.
 * - Only logging in counts as an active day.
 * - 1 grace day per window: exactly one missed calendar day is forgiven and does not break the streak.
 * - A second missed day (or any single gap of 2+ days at once) resets forward progress.
 * - Window restarts from the day of that login upon reset.
 * - Rewards already claimed before a reset are NEVER clawed back.
 */

export interface LoginHistoryEntry {
  date: string; // ISO date format YYYY-MM-DD
  timestamp: number;
}

export interface MilestoneReward {
  day: number;
  rewardType: 'cosmetic' | 'airtime';
  amountNgn?: number;
  description: string;
}

export interface LoginStreakState {
  windowStartDate: string; // YYYY-MM-DD
  currentStreakDays: number;
  hasUsedGraceDay: boolean;
  graceDayDate: string | null;
  claimedMilestones: number[];
  lastLoginDate: string; // YYYY-MM-DD
  totalWindowDays: number; // 30
  isWindowCompleted: boolean;
  history: string[]; // List of YYYY-MM-DD login dates in current window
}

export const STREAK_WINDOW_LENGTH = 30;

export const MILESTONE_REWARDS_FREE: MilestoneReward[] = [
  { day: 7, rewardType: 'cosmetic', description: 'Royal Bronze Card Back & +1 Bonus Practice Match Slot' },
  { day: 14, rewardType: 'airtime', amountNgn: 30, description: '₦30 Airtime / Data Top-up' },
  { day: 20, rewardType: 'airtime', amountNgn: 100, description: '₦100 Airtime + Game & Community Leaderboard Qualification' },
  { day: 30, rewardType: 'airtime', amountNgn: 150, description: '₦150 Full Cycle Airtime Bonus + Champion Badge' },
];

export const MILESTONE_REWARDS_PREMIUM: MilestoneReward[] = [
  { day: 7, rewardType: 'cosmetic', description: 'Exclusive Golden Whot Card Skin & Royal Avatar Frame' },
  { day: 14, rewardType: 'airtime', amountNgn: 100, description: '₦100 Airtime / Data Top-up' },
  { day: 20, rewardType: 'airtime', amountNgn: 300, description: '₦300 Airtime + Premium Leaderboard Badge' },
  { day: 30, rewardType: 'airtime', amountNgn: 400, description: '₦400 Cumulative Airtime Bonus' },
];

/**
 * Calculates day difference between two YYYY-MM-DD strings.
 */
export function calculateCalendarDayDifference(earlierDateStr: string, laterDateStr: string): number {
  const dateEarlier = new Date(`${earlierDateStr}T00:00:00Z`);
  const dateLater = new Date(`${laterDateStr}T00:00:00Z`);
  const diffTimeMs = dateLater.getTime() - dateEarlier.getTime();
  return Math.round(diffTimeMs / (1000 * 60 * 60 * 24));
}

/**
 * Initialize brand new streak state on first login
 */
export function initializeLoginStreak(firstLoginDate: string): LoginStreakState {
  if (!firstLoginDate || !/^\d{4}-\d{2}-\d{2}$/.test(firstLoginDate)) {
    throw new Error(`Invalid login date format: ${firstLoginDate}. Expected YYYY-MM-DD.`);
  }

  return {
    windowStartDate: firstLoginDate,
    currentStreakDays: 1,
    hasUsedGraceDay: false,
    graceDayDate: null,
    claimedMilestones: [],
    lastLoginDate: firstLoginDate,
    totalWindowDays: STREAK_WINDOW_LENGTH,
    isWindowCompleted: false,
    history: [firstLoginDate],
  };
}

/**
 * Process a user login event against their existing streak state.
 *
 * Cases:
 * 1. Same day login: Idempotent, returns unchanged state.
 * 2. Consecutive day (diff = 1): Streak increments by 1.
 * 3. 1 day skipped (diff = 2):
 *    - If grace day NOT used yet: Grace day is consumed, streak increments by 1.
 *    - If grace day ALREADY used: Reset streak forward progress, window restarts today.
 * 4. 2+ days skipped (diff >= 3): Any gap >= 2 days resets forward progress, window restarts today.
 * 5. Window boundary (Day 30 reached): Window completed.
 */
export function processLoginStreakEvent(
  currentState: LoginStreakState,
  newLoginDate: string
): LoginStreakState {
  if (!newLoginDate || !/^\d{4}-\d{2}-\d{2}$/.test(newLoginDate)) {
    throw new Error(`Invalid newLoginDate format: ${newLoginDate}. Expected YYYY-MM-DD.`);
  }

  const diffDays = calculateCalendarDayDifference(currentState.lastLoginDate, newLoginDate);

  if (diffDays < 0) {
    throw new Error(`Login date ${newLoginDate} is earlier than last login date ${currentState.lastLoginDate}`);
  }

  // Same day login: idempotent
  if (diffDays === 0) {
    return { ...currentState };
  }

  // Consecutive day
  if (diffDays === 1) {
    const nextStreak = currentState.currentStreakDays + 1;
    const isCompleted = nextStreak >= STREAK_WINDOW_LENGTH;

    return {
      ...currentState,
      currentStreakDays: nextStreak,
      lastLoginDate: newLoginDate,
      isWindowCompleted: isCompleted,
      history: [...currentState.history, newLoginDate],
    };
  }

  // Missed exactly 1 day (e.g. Day 1 was Monday, next login is Wednesday -> diff = 2)
  if (diffDays === 2) {
    if (!currentState.hasUsedGraceDay) {
      // Forgive the missed day via Grace Day
      const missedDayDate = new Date(`${currentState.lastLoginDate}T00:00:00Z`);
      missedDayDate.setUTCDate(missedDayDate.getUTCDate() + 1);
      const graceDayStr = missedDayDate.toISOString().slice(0, 10);

      const nextStreak = currentState.currentStreakDays + 1;
      const isCompleted = nextStreak >= STREAK_WINDOW_LENGTH;

      return {
        ...currentState,
        currentStreakDays: nextStreak,
        hasUsedGraceDay: true,
        graceDayDate: graceDayStr,
        lastLoginDate: newLoginDate,
        isWindowCompleted: isCompleted,
        history: [...currentState.history, newLoginDate],
      };
    } else {
      // Second missed day in the same window!
      // Forward progress resets. Claimed milestones are preserved.
      return {
        windowStartDate: newLoginDate,
        currentStreakDays: 1,
        hasUsedGraceDay: false,
        graceDayDate: null,
        claimedMilestones: currentState.claimedMilestones, // NEVER clawed back
        lastLoginDate: newLoginDate,
        totalWindowDays: STREAK_WINDOW_LENGTH,
        isWindowCompleted: false,
        history: [newLoginDate],
      };
    }
  }

  // Gap of 2 or more days (diff >= 3)
  // Hard reset forward progress, window restarts today
  return {
    windowStartDate: newLoginDate,
    currentStreakDays: 1,
    hasUsedGraceDay: false,
    graceDayDate: null,
    claimedMilestones: currentState.claimedMilestones, // NEVER clawed back
    lastLoginDate: newLoginDate,
    totalWindowDays: STREAK_WINDOW_LENGTH,
    isWindowCompleted: false,
    history: [newLoginDate],
  };
}

/**
 * Claim an unearned milestone reward.
 * Returns updated state with the claimed milestone recorded.
 */
export function claimStreakMilestone(
  currentState: LoginStreakState,
  milestoneDay: number
): LoginStreakState {
  if (currentState.currentStreakDays < milestoneDay) {
    throw new Error(
      `Cannot claim milestone for day ${milestoneDay}. Current streak is ${currentState.currentStreakDays}.`
    );
  }

  if (currentState.claimedMilestones.includes(milestoneDay)) {
    throw new Error(`Milestone for day ${milestoneDay} has already been claimed.`);
  }

  return {
    ...currentState,
    claimedMilestones: [...currentState.claimedMilestones, milestoneDay],
  };
}
