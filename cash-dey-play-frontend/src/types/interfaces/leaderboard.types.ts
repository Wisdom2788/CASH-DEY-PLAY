export interface CommunityLeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  qualifyingInviteCount: number;
  rank: number;
  prizePercent: number;
  isEligible: boolean;
}