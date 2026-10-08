import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getService, postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { API_ROUTES } from '../config/constant.config';
import { MatchState, OpponentProfile } from '../types/interfaces/match.types';
import { WhotCard } from '../types/interfaces/card.types';
import { WhotSuit, MatchMode } from '../types/enums/whot.enums';

export const MatchQueryKeys = {
  recentOpponents: 'recentOpponents',
};

export const useGetRecentOpponents = (
  queryOptions: Omit<UseQueryOptions<OpponentProfile[], AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  return useQuery<OpponentProfile[], AxiosError>({
    queryKey: [MatchQueryKeys.recentOpponents],
    queryFn: () => getService<OpponentProfile[]>(API_ROUTES.MATCH_RECENT, options),
    ...queryOptions,
  });
};

export const useStartMatch = (
  mutationOptions?: UseMutationOptions<MatchState, AxiosError, { mode: MatchMode; opponentId?: string }>,
  options?: RequestOptions
) => {
  return useMutation<MatchState, AxiosError, { mode: MatchMode; opponentId?: string }>({
    mutationFn: (payload) =>
      postService<{ mode: MatchMode; opponentId?: string }, MatchState>(API_ROUTES.MATCH_START, payload, options),
    ...mutationOptions,
  });
};

export const useMatchMove = (
  mutationOptions?: UseMutationOptions<MatchState, AxiosError, { matchId: string; cardId: string; nominatedSuit?: WhotSuit }>,
  options?: RequestOptions
) => {
  return useMutation<MatchState, AxiosError, { matchId: string; cardId: string; nominatedSuit?: WhotSuit }>({
    mutationFn: (payload) =>
      postService<{ matchId: string; cardId: string; nominatedSuit?: WhotSuit }, MatchState>(
        API_ROUTES.MATCH_MOVE,
        payload,
        options
      ),
    ...mutationOptions,
  });
};

export const useMatchDraw = (
  mutationOptions?: UseMutationOptions<MatchState, AxiosError, { matchId: string }>,
  options?: RequestOptions
) => {
  return useMutation<MatchState, AxiosError, { matchId: string }>({
    mutationFn: (payload) =>
      postService<{ matchId: string }, MatchState>(API_ROUTES.MATCH_DRAW, payload, options),
    ...mutationOptions,
  });
};

export const useMatchForfeit = (
  mutationOptions?: UseMutationOptions<MatchState, AxiosError, { matchId: string }>,
  options?: RequestOptions
) => {
  return useMutation<MatchState, AxiosError, { matchId: string }>({
    mutationFn: (payload) =>
      postService<{ matchId: string }, MatchState>(API_ROUTES.MATCH_FORFEIT, payload, options),
    ...mutationOptions,
  });
};
