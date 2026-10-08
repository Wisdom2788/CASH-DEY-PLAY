import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { API_ROUTES } from '../config/constant.config';
import { IBaseResponse } from '../types/interfaces/general.types';

export const useSubscribePremium = (
  mutationOptions?: UseMutationOptions<IBaseResponse, AxiosError, void>,
  options?: RequestOptions
) => {
  return useMutation<IBaseResponse, AxiosError, void>({
    mutationFn: () => postService<Record<string, never>, IBaseResponse>(API_ROUTES.PREMIUM_SUBSCRIBE, {}, options),
    ...mutationOptions,
  });
};
