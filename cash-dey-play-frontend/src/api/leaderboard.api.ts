import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  PlayerLeaderboardStanding,
} from '../qualification/monthly-leaderboard/monthly-leaderboard-eligibility';
import { CommunityLeaderboardEntry } from '../types/interfaces/leaderboard.types';
import { API_ROUTES } from '../config/constant.config';
import { getService } from './client';

export const LeaderboardQueryKeys = {
  gameLeaderboard: "game-leaderboard",
  communityLeaderboard: "community-leaderboard",
}

export const useGetMonthlyGameLeaderboard = (
  queryOptions: Omit<UseQueryOptions<PlayerLeaderboardStanding[], AxiosError>, 'queryKey' | 'queryFn'> = {},
) => {
  return useQuery<PlayerLeaderboardStanding[], AxiosError>({
    queryKey: [LeaderboardQueryKeys.gameLeaderboard],
    queryFn: () => getService<PlayerLeaderboardStanding[]>(API_ROUTES.LEADERBOARD_GAME),
    ...queryOptions,
  });
}

export const useGetCommunityLeaderboard = (
  queryOptions: Omit<UseQueryOptions<CommunityLeaderboardEntry[], AxiosError>, 'queryKey' | 'queryFn'> = {},
) => {
  return useQuery<CommunityLeaderboardEntry[], AxiosError>({
    queryKey: [LeaderboardQueryKeys.communityLeaderboard],
    queryFn: () => getService<CommunityLeaderboardEntry[]>(API_ROUTES.LEADERBOARD_COMMUNITY),
    ...queryOptions,
  });
}

