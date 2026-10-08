/**
 * Unit Tests for Monthly Leaderboard Eligibility & Ranking Engine
 *
 * Verifies all rules from Section 2.2 & 6:
 * - 20 non-consecutive active task days
 * - >= 15 match wins
 * - Hard count, no grace days
 * - Weighted score = win_rate * (matches_played / 50)
 * - Tiebreakers: wins, fewest losses, earliest 15th win
 */

import {
  evaluateMonthlyLeaderboardEligibility,
  calculateWeightedLeaderboardScore,
  rankMonthlyLeaderboard,
  PlayerMonthStats,
} from './monthly-leaderboard-eligibility';

describe('MonthlyLeaderboardEligibility', () => {
  const basePlayer: PlayerMonthStats = {
    userId: 'user_1',
    username: 'Chinedu',
    calendarMonth: '2026-09',
    activeTaskDaysCount: 20,
    matchesPlayed: 30,
    matchesWon: 20,
    matchesLost: 10,
    fifteenthWinTimestamp: 1726000000000,
  };

  describe('evaluateMonthlyLeaderboardEligibility', () => {
    it('approves player with exactly 20 active days and 15 wins (boundary condition)', () => {
      const boundaryPlayer: PlayerMonthStats = {
        ...basePlayer,
        activeTaskDaysCount: 20,
        matchesWon: 15,
      };

      const result = evaluateMonthlyLeaderboardEligibility(boundaryPlayer);
      expect(result.isEligible).toBe(true);
      expect(result.disqualificationReason).toBeUndefined();
    });

    it('rejects player with 19 active days even with high wins (1 below threshold)', () => {
      const player: PlayerMonthStats = {
        ...basePlayer,
        activeTaskDaysCount: 19,
        matchesWon: 25,
      };

      const result = evaluateMonthlyLeaderboardEligibility(player);
      expect(result.isEligible).toBe(false);
      expect(result.disqualificationReason).toContain('1 more active task days');
    });

    it('rejects player with 25 active days but only 14 wins (1 below threshold)', () => {
      const player: PlayerMonthStats = {
        ...basePlayer,
        activeTaskDaysCount: 25,
        matchesWon: 14,
      };

      const result = evaluateMonthlyLeaderboardEligibility(player);
      expect(result.isEligible).toBe(false);
      expect(result.disqualificationReason).toContain('1 more match wins');
    });

    it('rejects player failing both criteria', () => {
      const player: PlayerMonthStats = {
        ...basePlayer,
        activeTaskDaysCount: 5,
        matchesWon: 3,
      };

      const result = evaluateMonthlyLeaderboardEligibility(player);
      expect(result.isEligible).toBe(false);
    });
  });

  describe('calculateWeightedLeaderboardScore', () => {
    it('calculates score correctly for 25 wins out of 50 matches (50% win rate, full cap factor)', () => {
      const { winRate, weightedScore } = calculateWeightedLeaderboardScore(50, 25);
      expect(winRate).toBe(0.5);
      expect(weightedScore).toBe(50.0);
    });

    it('rewards deep volume over small sample streak (prevents small sample streak gaming)', () => {
      // Player A: 15 wins out of 15 matches (100% win rate, but only 15 matches -> factor 15/50 = 0.3)
      const playerA = calculateWeightedLeaderboardScore(15, 15);
      // weightedScore = 1.0 * (15/50) * 100 = 30.0

      // Player B: 30 wins out of 40 matches (75% win rate, 40 matches -> factor 40/50 = 0.8)
      const playerB = calculateWeightedLeaderboardScore(40, 30);
      // weightedScore = 0.75 * 0.8 * 100 = 60.0

      expect(playerB.weightedScore).toBeGreaterThan(playerA.weightedScore);
    });

    it('handles 0 matches played cleanly without NaN', () => {
      const { winRate, weightedScore } = calculateWeightedLeaderboardScore(0, 0);
      expect(winRate).toBe(0);
      expect(weightedScore).toBe(0);
    });
  });

  describe('rankMonthlyLeaderboard', () => {
    it('ranks eligible players higher than ineligible players', () => {
      const qualified: PlayerMonthStats = {
        userId: 'u1',
        username: 'Tayo_92',
        calendarMonth: '2026-09',
        activeTaskDaysCount: 22,
        matchesPlayed: 40,
        matchesWon: 28,
        matchesLost: 12,
        fifteenthWinTimestamp: 1726000000000,
      };

      const unqualified: PlayerMonthStats = {
        userId: 'u2',
        username: 'UnqualifiedPro',
        calendarMonth: '2026-09',
        activeTaskDaysCount: 10, // not qualified
        matchesPlayed: 50,
        matchesWon: 45,
        matchesLost: 5,
        fifteenthWinTimestamp: 1726000000000,
      };

      const ranked = rankMonthlyLeaderboard([unqualified, qualified]);
      expect(ranked[0].userId).toBe('u1');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].isEligible).toBe(true);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].isEligible).toBe(false);
    });

    it('applies tiebreaker: earliest 15th win date when weighted score, wins and losses are tied', () => {
      const playerEarlier: PlayerMonthStats = {
        userId: 'p1',
        username: 'Speedy',
        calendarMonth: '2026-09',
        activeTaskDaysCount: 20,
        matchesPlayed: 40,
        matchesWon: 30,
        matchesLost: 10,
        fifteenthWinTimestamp: 1000,
      };

      const playerLater: PlayerMonthStats = {
        userId: 'p2',
        username: 'Latecomer',
        calendarMonth: '2026-09',
        activeTaskDaysCount: 20,
        matchesPlayed: 40,
        matchesWon: 30,
        matchesLost: 10,
        fifteenthWinTimestamp: 2000,
      };

      const ranked = rankMonthlyLeaderboard([playerLater, playerEarlier]);
      expect(ranked[0].userId).toBe('p1');
      expect(ranked[1].userId).toBe('p2');
    });
  });
});
