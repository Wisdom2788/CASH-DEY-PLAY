import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile } from '../types/interfaces/user.types';
import { type LoginStreakState } from '../qualification/login-streak/login-streak-engine';
import { getCookiesStorageDefinitions } from '../helpers/storage.helpers'; // Assuming we'll create this to match portal

interface AuthStoreState {
  user: UserProfile | null;
  loginStreak: LoginStreakState | null;
  isAuthenticated: boolean;
  token: string | null;
  setAuthData: (user: UserProfile, token: string) => void;
  clearAuth: () => void;
  syncStreakState: (streak: LoginStreakState) => void;
}

const cookieStorage = getCookiesStorageDefinitions();

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
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


    }),
    {
      name: 'cdp-auth-storage',
      storage: createJSONStorage(() => cookieStorage),
    }
  )
);
