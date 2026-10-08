import { TelecomProvider } from '../enums/whot.enums';

export interface WalletTransaction {
  id: string;
  type: 'MILESTONE_REWARD' | 'AIRTIME_CASHOUT' | 'LEADERBOARD_PRIZE' | 'BOOST_EARN';
  amountNgn: number;
  timestamp: number;
  description: string;
  provider?: TelecomProvider;
  phoneNumber?: string;
  status: 'SUCCESS' | 'PENDING';
}

export interface WalletState {
  balanceNgn: number;
  transactions: WalletTransaction[];
  preferredProvider: TelecomProvider;
  phoneNumber: string;
}

export interface WalletBalanceResponse {
  balanceNgn: number;
}

export interface WalletRedemptionPayload {
  amountNgn: number;
  provider: TelecomProvider;
  phoneNumber: string;
}

export interface WalletRedemptionResponse {
  success: boolean;
  message: string;
  newBalanceNgn?: number;
  transaction?: WalletTransaction;
}
