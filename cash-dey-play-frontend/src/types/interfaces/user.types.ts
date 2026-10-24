export interface UserProfile {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarUrl: string | null;
  isPhoneVerified: boolean;
  isPremium: boolean;
  premiumExpiryDate?: string | null;
  xp: number;
  points: number;
  monthlyRank: number | null;
  monthlyTrend: number | null; // e.g. +5
  matchesWonMonth: number;
  matchesPlayedMonth: number;
  referralCode: string | null;
  activeTaskDaysCount: number;
}
