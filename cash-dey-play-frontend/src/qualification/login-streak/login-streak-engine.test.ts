/**
 * Unit Tests for Login Streak Engine
 *
 * Verifies all business rules from Section 2.1 & 7:
 * - Personal 30-day window
 * - 1 forgiven grace day
 * - Second missed day resets forward progress
 * - Claimed rewards are never clawed back
 * - 2+ days gap resets forward progress
 */

import {
  initializeLoginStreak,
  processLoginStreakEvent,
  claimStreakMilestone,
  calculateCalendarDayDifference,
  STREAK_WINDOW_LENGTH,
  LoginStreakState,
} from './login-streak-engine';

describe('LoginStreakEngine', () => {
  describe('initializeLoginStreak', () => {
    it('initializes a fresh streak on first login date', () => {
      const state = initializeLoginStreak('2026-09-01');
      expect(state.windowStartDate).toBe('2026-09-01');
      expect(state.currentStreakDays).toBe(1);
      expect(state.hasUsedGraceDay).toBe(false);
      expect(state.graceDayDate).toBeNull();
      expect(state.claimedMilestones).toEqual([]);
      expect(state.lastLoginDate).toBe('2026-09-01');
      expect(state.totalWindowDays).toBe(STREAK_WINDOW_LENGTH);
      expect(state.isWindowCompleted).toBe(false);
      expect(state.history).toEqual(['2026-09-01']);
    });

    it('throws on invalid date string', () => {
      expect(() => initializeLoginStreak('invalid-date')).toThrow(/Invalid login date format/);
    });
  });

  describe('calculateCalendarDayDifference', () => {
    it('calculates 1 day difference correctly', () => {
      expect(calculateCalendarDayDifference('2026-09-01', '2026-09-02')).toBe(1);
    });

    it('calculates 2 day difference (1 day skipped)', () => {
      expect(calculateCalendarDayDifference('2026-09-01', '2026-09-03')).toBe(2);
    });

    it('calculates month boundary difference', () => {
      expect(calculateCalendarDayDifference('2026-09-30', '2026-10-01')).toBe(1);
    });
  });

  describe('processLoginStreakEvent', () => {
    it('handles same-day login idempotently without incrementing streak', () => {
      const initial = initializeLoginStreak('2026-09-01');
      const sameDay = processLoginStreakEvent(initial, '2026-09-01');

      expect(sameDay.currentStreakDays).toBe(1);
      expect(sameDay.lastLoginDate).toBe('2026-09-01');
      expect(sameDay.history).toEqual(['2026-09-01']);
    });

    it('increments streak on consecutive day login', () => {
      const state1 = initializeLoginStreak('2026-09-01');
      const state2 = processLoginStreakEvent(state1, '2026-09-02');

      expect(state2.currentStreakDays).toBe(2);
      expect(state2.lastLoginDate).toBe('2026-09-02');
      expect(state2.hasUsedGraceDay).toBe(false);
      expect(state2.history).toEqual(['2026-09-01', '2026-09-02']);
    });

    it('uses 1 grace day when exactly 1 calendar day is missed', () => {
      let state = initializeLoginStreak('2026-09-01'); // Day 1
      state = processLoginStreakEvent(state, '2026-09-02'); // Day 2
      // Missed 2026-09-03, logs in 2026-09-04 (gap = 2 days)
      const afterGrace = processLoginStreakEvent(state, '2026-09-04');

      expect(afterGrace.currentStreakDays).toBe(3);
      expect(afterGrace.hasUsedGraceDay).toBe(true);
      expect(afterGrace.graceDayDate).toBe('2026-09-03');
      expect(afterGrace.lastLoginDate).toBe('2026-09-04');
    });

    it('resets forward progress when a SECOND missed day occurs in the same window', () => {
      let state = initializeLoginStreak('2026-09-01'); // Day 1
      state = processLoginStreakEvent(state, '2026-09-02'); // Day 2
      // Missed 2026-09-03, logged in 2026-09-04 (1st grace used)
      state = processLoginStreakEvent(state, '2026-09-04');
      expect(state.hasUsedGraceDay).toBe(true);
      expect(state.currentStreakDays).toBe(3);

      // Now claims Day 7 after some consecutive logins
      state = {
        ...state,
        currentStreakDays: 8,
        lastLoginDate: '2026-09-09',
        claimedMilestones: [7], // Already claimed Day 7
      };

      // Misses 2026-09-10, logs in on 2026-09-11 (second missed day in window!)
      const afterSecondMiss = processLoginStreakEvent(state, '2026-09-11');

      // Forward progress resets to 1, window restarts on today
      expect(afterSecondMiss.currentStreakDays).toBe(1);
      expect(afterSecondMiss.windowStartDate).toBe('2026-09-11');
      expect(afterSecondMiss.hasUsedGraceDay).toBe(false);
      expect(afterSecondMiss.graceDayDate).toBeNull();
      // Crucial: claimed milestones are NEVER clawed back
      expect(afterSecondMiss.claimedMilestones).toEqual([7]);
      expect(afterSecondMiss.history).toEqual(['2026-09-11']);
    });

    it('resets forward progress when gap is 2 or more consecutive missed days (gap >= 3)', () => {
      let state = initializeLoginStreak('2026-09-01'); // Day 1
      state = claimStreakMilestone({ ...state, currentStreakDays: 14 }, 7);

      // Logged in on 2026-09-01, then next login is 2026-09-05 (4 days difference, 3 missed days)
      const afterLongGap = processLoginStreakEvent(state, '2026-09-05');

      expect(afterLongGap.currentStreakDays).toBe(1);
      expect(afterLongGap.windowStartDate).toBe('2026-09-05');
      expect(afterLongGap.claimedMilestones).toEqual([7]);
    });

    it('throws error when newLoginDate is in the past', () => {
      const state = initializeLoginStreak('2026-09-10');
      expect(() => processLoginStreakEvent(state, '2026-09-08')).toThrow(
        /is earlier than last login date/
      );
    });
  });

  describe('claimStreakMilestone', () => {
    it('allows claiming milestone when current streak meets threshold', () => {
      const state: LoginStreakState = {
        windowStartDate: '2026-09-01',
        currentStreakDays: 14,
        hasUsedGraceDay: false,
        graceDayDate: null,
        claimedMilestones: [],
        lastLoginDate: '2026-09-14',
        totalWindowDays: 30,
        isWindowCompleted: false,
        history: [],
      };

      const updated = claimStreakMilestone(state, 14);
      expect(updated.claimedMilestones).toContain(14);
    });

    it('throws error if threshold is not reached', () => {
      const state = initializeLoginStreak('2026-09-01');
      expect(() => claimStreakMilestone(state, 7)).toThrow(/Cannot claim milestone/);
    });

    it('throws error if milestone was already claimed', () => {
      const state: LoginStreakState = {
        windowStartDate: '2026-09-01',
        currentStreakDays: 14,
        hasUsedGraceDay: false,
        graceDayDate: null,
        claimedMilestones: [14],
        lastLoginDate: '2026-09-14',
        totalWindowDays: 30,
        isWindowCompleted: false,
        history: [],
      };

      expect(() => claimStreakMilestone(state, 14)).toThrow(/already been claimed/);
    });
  });
});
