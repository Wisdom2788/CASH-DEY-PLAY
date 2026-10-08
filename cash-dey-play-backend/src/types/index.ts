export interface UserProfile {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarUrl: string | null;
  isPhoneVerified: boolean;
  isPremium: boolean;
  xp: number;
  points: number;
  monthlyRank: number | null;
  monthlyTrend: number | null;
  matchesWonMonth: number;
  matchesPlayedMonth: number;
  referralCode: string | null;
  activeTaskDaysCount: number;
}
