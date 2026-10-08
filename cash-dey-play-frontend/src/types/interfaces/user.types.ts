export interface UserProfile {
  id: string;
  telegramId: number;
  username: string;
  firstName: string;
  avatarUrl: string;
  isPhoneVerified: boolean;
  isPremium: boolean;
  premiumExpiryDate?: string | null;
  xp: number;
  points: number;
  monthlyRank: number;
  monthlyTrend: number; // e.g. +5
  matchesWonMonth: number;
  matchesPlayedMonth: number;
  referralCode: string;
  activeTaskDaysCount: number;
  createdAt: string;
  updatedAt: string;
}
