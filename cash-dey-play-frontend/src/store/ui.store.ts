import { create } from 'zustand';
import { toast } from 'react-toastify';

export type ScreenId = 'home' | 'tasks' | 'lobby' | 'game' | 'result' | 'leaderboard' | 'profile' | 'wallet';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface RewardedAdModalState {
  isOpen: boolean;
  rewardType: 'BOOST_POINTS' | 'PRACTICE_MATCH' | 'COOLDOWN_SKIP' | 'TASK_UNLOCK';
  title: string;
  subtitle: string;
  rewardAmount: string;
  onRewardGranted?: () => void;
}

interface UIStoreState {
  currentScreen: ScreenId;
  activeNavTab: 'home' | 'tasks' | 'play' | 'leaderboard' | 'profile';
  toasts: ToastNotification[];
  rewardedAdModal: RewardedAdModalState;
  setScreen: (screen: ScreenId) => void;
  setActiveNavTab: (tab: 'home' | 'tasks' | 'play' | 'leaderboard' | 'profile') => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  openRewardedAd: (options: Omit<RewardedAdModalState, 'isOpen'>) => void;
  closeRewardedAd: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  currentScreen: 'home',
  activeNavTab: 'home',
  toasts: [],
  rewardedAdModal: {
    isOpen: false,
    rewardType: 'BOOST_POINTS',
    title: 'BOOST REWARDS',
    subtitle: 'Watch a 5s rewarded video to earn 50 reward points',
    rewardAmount: '+50 Points',
  },

  setScreen: (screen) => {
    // Map screen to bottom navigation tab when sensible
    let navTab: 'home' | 'tasks' | 'play' | 'leaderboard' | 'profile' = 'home';
    if (screen === 'home') navTab = 'home';
    else if (screen === 'tasks') navTab = 'tasks';
    else if (screen === 'lobby' || screen === 'game' || screen === 'result') navTab = 'play';
    else if (screen === 'leaderboard') navTab = 'leaderboard';
    else if (screen === 'profile' || screen === 'wallet') navTab = 'profile';

    set({ currentScreen: screen, activeNavTab: navTab });
  },

  setActiveNavTab: (tab) => {
    let screen: ScreenId = 'home';
    if (tab === 'home') screen = 'home';
    else if (tab === 'tasks') screen = 'tasks';
    else if (tab === 'play') screen = 'lobby';
    else if (tab === 'leaderboard') screen = 'leaderboard';
    else if (tab === 'profile') screen = 'profile';

    set({ activeNavTab: tab, currentScreen: screen });
  },

  showToast: (message, type = 'success') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'info':
        toast.info(message);
        break;
      default:
        toast(message);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  openRewardedAd: (options) => {
    set({
      rewardedAdModal: {
        isOpen: true,
        ...options,
      },
    });
  },

  closeRewardedAd: () => {
    set((state) => ({
      rewardedAdModal: {
        ...state.rewardedAdModal,
        isOpen: false,
      },
    }));
  },
}));
