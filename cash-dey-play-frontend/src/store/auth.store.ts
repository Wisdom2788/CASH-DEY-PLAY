import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile } from '../types/interfaces/user.types';
import {
  LoginStreakState,
  initializeLoginStreak,
  processLoginStreakEvent,
  claimStreakMilestone,
} from '../qualification/login-streak/login-streak-engine';
import { getCookiesStorageDefinitions } from '../helpers/storage.helpers'; // Assuming we'll create this to match portal

interface AuthStoreState {
  user: UserProfile | null;
  loginStreak: LoginStreakState | null;
  isAuthenticated: boolean;
  token: string | null;
  setAuthData: (user: UserProfile, token: string) => void;
  clearAuth: () => void;
  syncStreakState: (streak: LoginStreakState) => void;
  claimStreakReward: (day: number) => { success: boolean; rewardAirtimeNgn?: number };
  upgradeToPremium: () => void;
  updateUserStats: (xpDelta: number, pointsDelta: number, wonMatch: boolean) => void;
}

const cookieStorage = getCookiesStorageDefinitions();

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      loginStreak: null,
      isAuthenticated: false,
      token: null,

      setAuthData: (user, token) => {
        set({ user, token, isAuthenticated: true });
        // After setting auth, we typically expect the component layer to fetch streak state
        // and call syncStreakState. If not fetched yet, it remains null.
      },

      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false, loginStreak: null });
      },

      syncStreakState: (streak) => {
        set({ loginStreak: streak });
      },

      claimStreakReward: (day: number) => {
        const currentStreak = get().loginStreak;
        const user = get().user;
        
        if (!currentStreak || !user) return { success: false };

        try {
          const updated = claimStreakMilestone(currentStreak, day);
          let rewardAirtime = 0;
          
          if (day === 14) rewardAirtime = user.isPremium ? 100 : 30;
          if (day === 20) rewardAirtime = user.isPremium ? 300 : 100;
          if (day === 30) rewardAirtime = user.isPremium ? 400 : 150;

          set({ loginStreak: updated });
          return { success: true, rewardAirtimeNgn: rewardAirtime };
        } catch {
          return { success: false };
        }
      },

      upgradeToPremium: () => {
        set((state) => {
          if (!state.user) return state;
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return {
            user: {
              ...state.user,
              isPremium: true,
              premiumExpiryDate: nextMonth.toISOString().slice(0, 10),
            },
          };
        });
      },

      updateUserStats: (xpDelta: number, pointsDelta: number, wonMatch: boolean) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              xp: state.user.xp + xpDelta,
              points: state.user.points + pointsDelta,
              matchesPlayedMonth: state.user.matchesPlayedMonth + 1,
              matchesWonMonth: wonMatch ? state.user.matchesWonMonth + 1 : state.user.matchesWonMonth,
            },
          };
        });
      },
    }),
    {
      name: 'cdp-auth-storage',
      storage: createJSONStorage(() => cookieStorage),
    }
  )
);
