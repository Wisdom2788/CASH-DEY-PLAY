import { create } from 'zustand';
import { MatchMode, MatchTurn, WhotSpecialEffect, WhotSuit } from '../types/enums/whot.enums';
import { WhotCard } from '../types/interfaces/card.types';
import { MatchState, OpponentProfile } from '../types/interfaces/match.types';

// Real-time Match State Store (Syncs with Socket.io / Server)
interface GameStoreState {
  isSearching: boolean;
  searchSeconds: number;
  activeMatch: MatchState | null;
  selectedCardId: string | null;
  isSuitPickerOpen: boolean;
  pendingWhotCard: WhotCard | null;
  recentReaction: string | null;
  
  // UI Actions
  setSearching: (isSearching: boolean) => void;
  setSearchSeconds: (seconds: number) => void;
  syncMatchState: (match: MatchState | null) => void;
  selectCard: (cardId: string | null) => void;
  setSuitPickerOpen: (isOpen: boolean, card?: WhotCard | null) => void;
  showReaction: (emoji: string) => void;
  tickTurnTimer: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  isSearching: false,
  searchSeconds: 0,
  activeMatch: null,
  selectedCardId: null,
  isSuitPickerOpen: false,
  pendingWhotCard: null,
  recentReaction: null,

  setSearching: (isSearching) => set({ isSearching }),
  
  setSearchSeconds: (searchSeconds) => set({ searchSeconds }),
  
  syncMatchState: (match) => {
    // Merge new state from server
    set({ activeMatch: match });
  },

  selectCard: (cardId) => {
    set({ selectedCardId: cardId });
  },

  setSuitPickerOpen: (isOpen, card = null) => {
    set({ isSuitPickerOpen: isOpen, pendingWhotCard: card });
  },

  showReaction: (emoji: string) => {
    set({ recentReaction: emoji });
    setTimeout(() => {
      set({ recentReaction: null });
    }, 2500);
  },

  tickTurnTimer: () => {
    set((state) => {
      if (state.activeMatch && state.activeMatch.turnTimeRemainingSeconds > 0) {
        return {
          activeMatch: {
            ...state.activeMatch,
            turnTimeRemainingSeconds: state.activeMatch.turnTimeRemainingSeconds - 1,
          },
        };
      }
      return state;
    });
  },
}));
