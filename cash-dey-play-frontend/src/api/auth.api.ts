import { UserProfile } from '../types/interfaces/user.types';
import { LoginStreakState } from '../qualification/login-streak/login-streak-engine';
import { getService, postService } from './client';

export async function fetchCurrentUser(): Promise<UserProfile> {
  // Replace with actual backend route for fetching current user
  return getService<UserProfile>('/users/me');
}

export async function syncStreakState(state: LoginStreakState): Promise<{ success: boolean }> {
  return postService<LoginStreakState, { success: boolean }>('/qualification/login-streak/sync', state);
}