import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getService, postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { API_ROUTES } from '../config/constant.config';
import { UserProfile } from '../types/interfaces/user.types';
import { IBaseResponse } from '../types/interfaces/general.types';

export const UserQueryKeys = {
  currentUser: 'currentUser',
};

export const useGetCurrentUser = (
  queryOptions: Omit<UseQueryOptions<UserProfile, AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  return useQuery<UserProfile, AxiosError>({
    queryKey: [UserQueryKeys.currentUser],
    queryFn: () => getService<UserProfile>(API_ROUTES.USER_ME, options),
    ...queryOptions,
  });
};

export const useUpdateUser = (
  mutationOptions?: UseMutationOptions<IBaseResponse, AxiosError, Partial<UserProfile>>,
  options?: RequestOptions
) => {
  return useMutation<IBaseResponse, AxiosError, Partial<UserProfile>>({
    mutationFn: (payload) =>
      postService<Partial<UserProfile>, IBaseResponse>(API_ROUTES.USER_ME, payload, options), // Note: typically PATCH or PUT, but PRD standardizes on postService
    ...mutationOptions,
  });
};
