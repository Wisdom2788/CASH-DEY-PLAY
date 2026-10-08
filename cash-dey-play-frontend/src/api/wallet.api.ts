import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getService, postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { API_ROUTES } from '../config/constant.config';
import {
  WalletBalanceResponse,
  WalletTransaction,
  WalletRedemptionPayload,
  WalletRedemptionResponse,
} from '../types/interfaces/wallet.types';

export const WalletQueryKeys = {
  balance: 'walletBalance',
  transactions: 'walletTransactions',
};

export const useGetWalletBalance = (
  queryOptions: Omit<UseQueryOptions<WalletBalanceResponse, AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  return useQuery<WalletBalanceResponse, AxiosError>({
    queryKey: [WalletQueryKeys.balance],
    queryFn: () => getService<WalletBalanceResponse>(API_ROUTES.WALLET_BALANCE, options),
    ...queryOptions,
  });
};

export const useGetWalletTransactions = (
  queryOptions: Omit<UseQueryOptions<WalletTransaction[], AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  return useQuery<WalletTransaction[], AxiosError>({
    queryKey: [WalletQueryKeys.transactions],
    queryFn: () => getService<WalletTransaction[]>(API_ROUTES.WALLET_TRANSACTIONS, options),
    ...queryOptions,
  });
};

export const useRedeemAirtime = (
  mutationOptions?: UseMutationOptions<WalletRedemptionResponse, AxiosError, WalletRedemptionPayload>,
  options?: RequestOptions
) => {
  return useMutation<WalletRedemptionResponse, AxiosError, WalletRedemptionPayload>({
    mutationFn: (payload) =>
      postService<WalletRedemptionPayload, WalletRedemptionResponse>(API_ROUTES.WALLET_REDEEM, payload, options),
    ...mutationOptions,
  });
};
