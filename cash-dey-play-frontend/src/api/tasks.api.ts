import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { getService, postService, type RequestOptions } from './client';
import { AxiosError } from 'axios';
import { tasksStateSchema,taskClaimSchema } from './tasks.contracts';
import { userProfileSchema } from './session.contracts';
import { useAuthStore } from '../store/auth.store';
import { API_ROUTES } from '../config/constant.config';
import { TasksState, TaskCompletionResponse, OptionalVideoResponse } from '../types/interfaces/tasks.types';

export const TaskQueryKeys = {
  tasksState: 'tasks-state',
};

export const useGetTasksState = (
  queryOptions: Omit<UseQueryOptions<TasksState, AxiosError>, 'queryKey' | 'queryFn'> = {},
  options?: RequestOptions
) => {
  const userId=useAuthStore(s=>s.user?.id);
  const token=useAuthStore(s=>s.token);
  return useQuery<TasksState, AxiosError>({
    queryKey: [TaskQueryKeys.tasksState,userId??null],
    enabled:!!token,
    refetchOnWindowFocus:'always',
    refetchOnReconnect:true,
    refetchInterval:query=>Math.max(1000,Math.min(60000,((query.state.data?.timeRemainingSeconds??59)+1)*1000)),
    queryFn: async () => tasksStateSchema.parse(await getService(API_ROUTES.TASKS_STATE, options)),
    ...queryOptions,
  });
};

export const useCompleteTask = (
  mutationOptions?: UseMutationOptions<TaskCompletionResponse, AxiosError, string>,
  options?: RequestOptions
) => {
  const queryClient = useQueryClient();

  return useMutation<TaskCompletionResponse, AxiosError, string>({
    mutationFn: (taskId) =>
      postService<{ taskId: string }, TaskCompletionResponse>(API_ROUTES.TASK_COMPLETE, { taskId }, options),
    ...mutationOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: [TaskQueryKeys.tasksState] });
      mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
};

export const useWatchOptionalVideo = (
  mutationOptions?: UseMutationOptions<OptionalVideoResponse, AxiosError, void>,
  options?: RequestOptions
) => {
  const queryClient = useQueryClient();

  return useMutation<OptionalVideoResponse, AxiosError, void>({
    mutationFn: () => postService<Record<string, never>, OptionalVideoResponse>(API_ROUTES.TASK_OPTIONAL_VIDEO, {}, options),
    ...mutationOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: [TaskQueryKeys.tasksState] });
      mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
};

export const useSkipCooldown = (
  mutationOptions?: UseMutationOptions<void, AxiosError, void>,
  options?: RequestOptions
) => {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, void>({
    mutationFn: () => postService<Record<string, never>, void>(API_ROUTES.TASK_SKIP_COOLDOWN, {}, options),
    ...mutationOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: [TaskQueryKeys.tasksState] });
      mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
};

export const useClaimExemptTask = () => {
 const queryClient=useQueryClient();
 return useMutation<TaskCompletionResponse,AxiosError,string>({
  mutationFn:async key=>taskClaimSchema.parse(await postService(`tasks/${encodeURIComponent(key)}/claim`,{})),
  onSuccess:async()=>{
   await queryClient.invalidateQueries({queryKey:[TaskQueryKeys.tasksState]});
   const token=useAuthStore.getState().token;
   try {const profile=userProfileSchema.parse(await getService(API_ROUTES.USER_ME));if(token && useAuthStore.getState().token===token)useAuthStore.getState().setAuthData(profile,token);}catch{/* The claim is committed; a profile refresh can be retried independently. */}
  },
 });
};
