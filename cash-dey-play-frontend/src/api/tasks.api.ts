import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getService, postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { API_ROUTES } from '../config/constant.config';
import { TasksState, TaskCompletionResponse, OptionalVideoResponse } from '../types/interfaces/tasks.types';

export const TaskQueryKeys = {
  tasksState: 'tasks-state',
};

export const useGetTasksState = (
  queryOptions: Omit<UseQueryOptions<TasksState, AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  return useQuery<TasksState, AxiosError>({
    queryKey: [TaskQueryKeys.tasksState],
    queryFn: () => getService<TasksState>(API_ROUTES.TASKS_STATE, options),
    ...queryOptions,
  });
};

export const useCompleteTask = (
  mutationOptions?: UseMutationOptions<TaskCompletionResponse, AxiosError, string>,
  options?: RequestOptions
) => {
  return useMutation<TaskCompletionResponse, AxiosError, string>({
    mutationFn: (taskId) =>
      postService<{ taskId: string }, TaskCompletionResponse>(API_ROUTES.TASK_COMPLETE, { taskId }, options),
    ...mutationOptions,
  });
};

export const useWatchOptionalVideo = (
  mutationOptions?: UseMutationOptions<OptionalVideoResponse, AxiosError, void>,
  options?: RequestOptions
) => {
  return useMutation<OptionalVideoResponse, AxiosError, void>({
    mutationFn: () => postService<Record<string, never>, OptionalVideoResponse>(API_ROUTES.TASK_OPTIONAL_VIDEO, {}, options),
    ...mutationOptions,
  });
};

export const useSkipCooldown = (
  mutationOptions?: UseMutationOptions<void, AxiosError, void>,
  options?: RequestOptions
) => {
  return useMutation<void, AxiosError, void>({
    mutationFn: () => postService<Record<string, never>, void>(API_ROUTES.TASK_SKIP_COOLDOWN, {}, options),
    ...mutationOptions,
  });
};

export const useRecordMatchResult = (
  mutationOptions?: UseMutationOptions<void, AxiosError, boolean>,
  options?: RequestOptions
) => {
  return useMutation<void, AxiosError, boolean>({
    mutationFn: (isWin) => postService<{ isWin: boolean }, void>(API_ROUTES.RECORD_MATCH, { isWin }, options),
    ...mutationOptions,
  });
};
