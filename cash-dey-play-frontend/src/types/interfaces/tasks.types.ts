export interface DailyTask {
  id: string;
  title: string;
  points: number;
  isCompleted: boolean;
  type: 'MANDATORY_VIDEO_LOGIN' | 'MANDATORY_VIDEO_UNLOCK' | 'WIN_MATCH' | 'BONUS_ALL_COMPLETE';
  progress: number;
  target: number;
}

export interface TasksState {
  tasks: DailyTask[];
  optionalVideosWatchedToday: number;
  practiceMatchesUnlocked: number;
  freeMatchesRemaining: number;
  cooldownActive: boolean;
  cooldownSecondsLeft: number;
  allBonusClaimed: boolean;
  timeRemainingSeconds: number;
}

export interface TaskCompletionResponse {
  pointsEarned: number;
}

export interface OptionalVideoResponse {
  success: boolean;
  practiceMatches: number;
}
