/**
 * Monthly Leaderboard Eligibility & Ranking Engine
 *
 * Confirmed Business Rules (§2.2 & §6):
 * - Calendar-month anchored (e.g. "2026-09").
 * - Open to all users, top 100 ranked.
 * - Eligibility:
 *   1. Complete daily tasks on >= 20 days within the calendar month.
 *   2. Win >= 15 matches within that calendar month.
 * - Hard count: NO grace days on this track.
 * - Ranking formula: weighted_score = win_rate * (matches_played / 50),
 *   capped at 50 for the match factor (matches_played / 50).
 * - Tiebreakers:
 *   1. Total wins (descending)
 *   2. Fewest losses (ascending)
 *   3. Earliest timestamp the 15th win was reached (ascending)
 */

export interface PlayerMonthStats {
  userId: string;
  username: string;
  avatarUrl?: string;
  calendarMonth: string; // e.g. "2026-09"
  activeTaskDaysCount: number; // days where user completed >= 1 daily task
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  fifteenthWinTimestamp: number | null; // Milliseconds timestamp of 15th win
}

export interface PlayerLeaderboardStanding extends PlayerMonthStats {
  isEligible: boolean;
  disqualificationReason?: string;
  winRate: number;
  weightedScore: number;
  rank?: number;
}

export const REQUIRED_ACTIVE_DAYS = 20;
export const REQUIRED_WINS = 15;
export const MAX_WEIGHTED_MATCH_CAP = 50;

/**
 * Checks whether a player satisfies the strict monthly leaderboard criteria:
 * - >= 20 task active days in the calendar month
 * - >= 15 match wins in the calendar month
 */
export function evaluateMonthlyLeaderboardEligibility(stats: PlayerMonthStats): {
  isEligible: boolean;
  disqualificationReason?: string;
} {
  if (stats.activeTaskDaysCount < REQUIRED_ACTIVE_DAYS && stats.matchesWon < REQUIRED_WINS) {
    return {
      isEligible: false,
      disqualificationReason: `Needs ${REQUIRED_ACTIVE_DAYS - stats.activeTaskDaysCount} more active task days and ${REQUIRED_WINS - stats.matchesWon} more wins`,
    };
  }

  if (stats.activeTaskDaysCount < REQUIRED_ACTIVE_DAYS) {
    return {
      isEligible: false,
      disqualificationReason: `Needs ${REQUIRED_ACTIVE_DAYS - stats.activeTaskDaysCount} more active task days (currently ${stats.activeTaskDaysCount}/${REQUIRED_ACTIVE_DAYS})`,
    };
  }

  if (stats.matchesWon < REQUIRED_WINS) {
    return {
      isEligible: false,
      disqualificationReason: `Needs ${REQUIRED_WINS - stats.matchesWon} more match wins (currently ${stats.matchesWon}/${REQUIRED_WINS})`,
    };
  }

  return { isEligible: true };
}

/**
 * Calculates the weighted leaderboard score:
 * weighted_score = win_rate * (matches_played / 50)
 *
 * win_rate = matches_won / matches_played (0 if 0 matches)
 * match_factor is clamped to at most 1.0 (50 matches) to prevent unlimited play volume inflation.
 */
export function calculateWeightedLeaderboardScore(matchesPlayed: number, matchesWon: number): {
  winRate: number;
  weightedScore: number;
} {
  if (matchesPlayed <= 0) {
    return { winRate: 0, weightedScore: 0 };
  }

  const winRate = matchesWon / matchesPlayed;
  // Match factor scaled up to 50 matches (e.g. 25/50 = 0.5, 50/50 = 1.0)
  const matchFactor = Math.min(matchesPlayed / MAX_WEIGHTED_MATCH_CAP, 1.0);
  const weightedScore = Number((winRate * matchFactor * 100).toFixed(2));

  return {
    winRate: Number(winRate.toFixed(4)),
    weightedScore,
  };
}

/**
 * Rank a list of players for the monthly leaderboard.
 * Ranks qualified players first based on weightedScore, then applies tiebreakers:
 * 1. Total wins (descending)
 * 2. Fewest losses (ascending)
 * 3. Earliest timestamp of 15th win (ascending)
 */
export function rankMonthlyLeaderboard(players: PlayerMonthStats[]): PlayerLeaderboardStanding[] {
  const evaluatedPlayers: PlayerLeaderboardStanding[] = players.map((player) => {
    const eligibility = evaluateMonthlyLeaderboardEligibility(player);
    const { winRate, weightedScore } = calculateWeightedLeaderboardScore(
      player.matchesPlayed,
      player.matchesWon
    );

    return {
      ...player,
      isEligible: eligibility.isEligible,
      disqualificationReason: eligibility.disqualificationReason,
      winRate,
      weightedScore,
    };
  });

  // Sort qualified players first, then non-qualified
  evaluatedPlayers.sort((a, b) => {
    // Both eligible: apply ranking formula + tiebreakers
    if (a.isEligible && b.isEligible) {
      // Primary: Weighted score
      if (b.weightedScore !== a.weightedScore) {
        return b.weightedScore - a.weightedScore;
      }
      // Tiebreaker 1: Total wins
      if (b.matchesWon !== a.matchesWon) {
        return b.matchesWon - a.matchesWon;
      }
      // Tiebreaker 2: Fewest losses
      if (a.matchesLost !== b.matchesLost) {
        return a.matchesLost - b.matchesLost;
      }
      // Tiebreaker 3: Earliest timestamp of 15th win
      const timeA = a.fifteenthWinTimestamp || Number.MAX_SAFE_INTEGER;
      const timeB = b.fifteenthWinTimestamp || Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    }

    if (a.isEligible && !b.isEligible) return -1;
    if (!a.isEligible && b.isEligible) return 1;

    // Both ineligible: sort by active days then wins
    if (b.activeTaskDaysCount !== a.activeTaskDaysCount) {
      return b.activeTaskDaysCount - a.activeTaskDaysCount;
    }
    return b.matchesWon - a.matchesWon;
  });

  // Assign 1-indexed ranks (top 100)
  return evaluatedPlayers.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));
}
