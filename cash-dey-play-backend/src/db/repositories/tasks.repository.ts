import { Pool } from "pg";

export interface TaskRow {
  id: string;
  title: string;
  points: number;
  isCompleted: boolean;
  type: string;
  progress: number;
  target: number;
}

export interface TasksStateRow {
  tasks: TaskRow[];
  optionalVideosWatchedToday: number;
  practiceMatchesUnlocked: number;
  freeMatchesRemaining: number;
  cooldownActive: boolean;
  cooldownSecondsLeft: number;
  allBonusClaimed: boolean;
  timeRemainingSeconds: number;
}

export interface TasksRepository {
  getTasksState(userId: string, today: string): Promise<TasksStateRow>;
  completeTask(userId: string, taskId: string, today: string): Promise<{ pointsEarned: number }>;
  recordOptionalVideo(userId: string, today: string): Promise<{ success: boolean; practiceMatches: number }>;
  recordMatchResult(userId: string, isWin: boolean): Promise<void>;
}

export class PostgresTasksRepository implements TasksRepository {
  constructor(private readonly pool: Pool) {}

  async getTasksState(userId: string, today: string): Promise<TasksStateRow> {
    // Get completed tasks for today
    const completedRes = await this.pool.query(
      `SELECT task_key FROM task_completions WHERE user_id = $1 AND completed_on = $2`,
      [userId, today]
    );
    const completedKeys = new Set(completedRes.rows.map((r: any) => r.task_key));

    // Get optional video count for today
    const videoRes = await this.pool.query(
      `SELECT COUNT(*) as cnt FROM task_completions 
       WHERE user_id = $1 AND completed_on = $2 AND task_key LIKE 'OPTIONAL_VIDEO_%'`,
      [userId, today]
    );
    const optionalVideosWatchedToday = parseInt(videoRes.rows[0].cnt, 10);

    // Get match wins today
    const matchWinRes = await this.pool.query(
      `SELECT COUNT(*) as cnt FROM matches
       WHERE user_id = $1 AND winner_id = $1 AND created_at::date = $2::date`,
      [userId, today]
    );
    const matchWins = parseInt(matchWinRes.rows[0].cnt, 10);

    // Build canonical 4-task list
    const tasks: TaskRow[] = [
      {
        id: "task_login_video",
        title: "Watch Daily Login Video",
        points: 50,
        isCompleted: completedKeys.has("MANDATORY_VIDEO_LOGIN"),
        type: "MANDATORY_VIDEO_LOGIN",
        progress: completedKeys.has("MANDATORY_VIDEO_LOGIN") ? 1 : 0,
        target: 1,
      },
      {
        id: "task_unlock_video",
        title: "Watch Match Unlock Video",
        points: 50,
        isCompleted: completedKeys.has("MANDATORY_VIDEO_UNLOCK"),
        type: "MANDATORY_VIDEO_UNLOCK",
        progress: completedKeys.has("MANDATORY_VIDEO_UNLOCK") ? 1 : 0,
        target: 1,
      },
      {
        id: "task_win_match",
        title: "Win 1 Match",
        points: 50,
        isCompleted: matchWins >= 1,
        type: "WIN_MATCH",
        progress: Math.min(matchWins, 1),
        target: 1,
      },
      {
        id: "task_all_complete",
        title: "Complete All Daily Tasks",
        points: 50,
        isCompleted: completedKeys.has("MANDATORY_VIDEO_LOGIN") && completedKeys.has("MANDATORY_VIDEO_UNLOCK") && matchWins >= 1,
        type: "BONUS_ALL_COMPLETE",
        progress: [completedKeys.has("MANDATORY_VIDEO_LOGIN"), completedKeys.has("MANDATORY_VIDEO_UNLOCK"), matchWins >= 1].filter(Boolean).length,
        target: 3,
      },
    ];

    // Calculate seconds remaining until midnight Lagos time (WAT, UTC+1)
    const nowMs = Date.now();
    // Simple: next midnight is start of next day
    const tomorrowLagos = new Date(today + "T00:00:00+01:00");
    tomorrowLagos.setDate(tomorrowLagos.getDate() + 1);
    const timeRemainingSeconds = Math.max(0, Math.floor((tomorrowLagos.getTime() - nowMs) / 1000));

    return {
      tasks,
      optionalVideosWatchedToday,
      practiceMatchesUnlocked: optionalVideosWatchedToday, // 1:1 mapping
      freeMatchesRemaining: Math.max(0, 3 - optionalVideosWatchedToday), // base 3 free
      cooldownActive: false, // TODO: implement cooldown tracking
      cooldownSecondsLeft: 0,
      allBonusClaimed: tasks.every((t) => t.isCompleted),
      timeRemainingSeconds,
    };
  }

  async completeTask(userId: string, taskId: string, today: string): Promise<{ pointsEarned: number }> {
    const taskKeyMap: Record<string, string> = {
      task_login_video: "MANDATORY_VIDEO_LOGIN",
      task_unlock_video: "MANDATORY_VIDEO_UNLOCK",
    };
    const taskKey = taskKeyMap[taskId];
    if (!taskKey) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    await this.pool.query(
      `INSERT INTO task_completions (user_id, completed_on, task_key) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, completed_on, task_key) DO NOTHING`,
      [userId, today, taskKey]
    );

    // Award points
    await this.pool.query(
      `UPDATE users SET points = points + 50, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    return { pointsEarned: 50 };
  }

  async recordOptionalVideo(userId: string, today: string): Promise<{ success: boolean; practiceMatches: number }> {
    // Count current optional videos
    const countRes = await this.pool.query(
      `SELECT COUNT(*) as cnt FROM task_completions
       WHERE user_id = $1 AND completed_on = $2 AND task_key LIKE 'OPTIONAL_VIDEO_%'`,
      [userId, today]
    );
    const count = parseInt(countRes.rows[0].cnt, 10);
    if (count >= 5) {
      return { success: false, practiceMatches: count };
    }

    const taskKey = `OPTIONAL_VIDEO_${count + 1}`;
    await this.pool.query(
      `INSERT INTO task_completions (user_id, completed_on, task_key) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, completed_on, task_key) DO NOTHING`,
      [userId, today, taskKey]
    );

    return { success: true, practiceMatches: count + 1 };
  }

  async recordMatchResult(userId: string, isWin: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO matches (user_id, winner_id) VALUES ($1, $2)`,
      [userId, isWin ? userId : null]
    );
    // Update user stats
    if (isWin) {
      await this.pool.query(
        `UPDATE users SET matches_won_month = matches_won_month + 1, matches_played_month = matches_played_month + 1, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
    } else {
      await this.pool.query(
        `UPDATE users SET matches_played_month = matches_played_month + 1, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
    }
  }
}
