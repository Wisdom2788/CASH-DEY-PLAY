import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TelecomProvider } from '../types/enums/whot.enums';
import { WalletState } from '../types/interfaces/wallet.types';
import { getCookiesStorageDefinitions } from '../helpers/storage.helpers';

interface WalletStoreActions {
  setProvider: (provider: TelecomProvider) => void;
  setPhoneNumber: (number: string) => void;
  // Transactions and balance will be managed by React Query fetching from the API.
  // The store only holds UI preferences (preferred provider and phone number for cashout).
}

const cookieStorage = getCookiesStorageDefinitions();

export const useWalletStore = create<WalletState & WalletStoreActions>()(
  persist(
    (set) => ({
      balanceNgn: 0, // Managed by query, default 0
      transactions: [], // Managed by query, default empty
      preferredProvider: TelecomProvider.MTN,
      phoneNumber: '',

      setProvider: (provider) => set({ preferredProvider: provider }),
      setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
    }),
    {
      name: 'cdp-wallet-prefs',
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({
        preferredProvider: state.preferredProvider,
        phoneNumber: state.phoneNumber,
      }) as any, // Only persist preferences
    }
  )
);
