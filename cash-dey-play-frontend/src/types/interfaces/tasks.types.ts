export interface DailyTask {
  id: string;
  title: string;
  points: number;
  action?: 'CLAIM' | 'WATCH_VIDEO' | 'PLAY_RANKED' | 'NONE';
  status?: 'AVAILABLE' | 'AUTO_READY' | 'CLAIMED';
  isCompleted: boolean;
  type: 'MANDATORY_VIDEO_LOGIN' | 'MANDATORY_VIDEO_UNLOCK' | 'WIN_MATCH' | 'BONUS_ALL_COMPLETE' | 'RANKED_FINISH' | 'RANKED_PLAY_CARDS' | 'RANKED_SUITS';
  progress: number;
  target: number;
}

export interface TasksState {
  lagosDate?: string;
  scheduleVersion?: 'legacy-v1' | 'rotating-v2';
  maxPoints?: number;
  pointsBalance?: number;
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
