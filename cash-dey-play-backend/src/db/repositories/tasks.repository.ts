import { secondsUntilNextLagosMidnight } from "../../time/lagos-calendar-clock";
import { Pool } from "pg";
import { TaskAlreadyCompletedError, UnknownTaskError } from "./tasks.errors";

const MANDATORY_TASK_POINTS = 50;

const TASK_KEY_BY_TASK_ID: Readonly<Record<string, string>> = {
  task_login_video: "MANDATORY_VIDEO_LOGIN",
  task_unlock_video: "MANDATORY_VIDEO_UNLOCK",
};

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
}

export class PostgresTasksRepository implements TasksRepository {
  constructor(private readonly pool: Pool) {}

  async getTasksState(userId: string, today: string): Promise<TasksStateRow> {
    // Get completed tasks for today
    const completedRes = await this.pool.query(
      `SELECT task_key FROM task_completions WHERE user_id = $1 AND completed_on = $2`,
      [userId, today]
    );
    const completedKeys = new Set(completedRes.rows.map((r: { task_key: string }) => r.task_key));

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
       WHERE user_id = $1 AND winner_id = $1 AND lagos_date = $2::date`,
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

    const timeRemainingSeconds = secondsUntilNextLagosMidnight(new Date());

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

  /**
   * Completes a mandatory task once per player per Lagos day.
   * The completion record and the points are written in ONE transaction, and points are added
   * only when the completion record is new, so repeating the request can never award points twice.
   */
  async completeTask(userId: string, taskId: string, today: string): Promise<{ pointsEarned: number }> {
    const taskKey = TASK_KEY_BY_TASK_ID[taskId];
    if (taskKey === undefined) {
      throw new UnknownTaskError(taskId);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const inserted = await client.query(
        `INSERT INTO task_completions (user_id, completed_on, task_key) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, completed_on, task_key) DO NOTHING
         RETURNING task_key`,
        [userId, today, taskKey],
      );
      if (inserted.rowCount === 0) {
        throw new TaskAlreadyCompletedError(taskId);
      }

      const awarded = await client.query(
        `UPDATE users SET points = points + $2, updated_at = NOW() WHERE id = $1`,
        [userId, MANDATORY_TASK_POINTS],
      );
      if (awarded.rowCount === 0) {
        throw new Error(`Cannot award points: user ${userId} does not exist.`);
      }

      await client.query("COMMIT");
      return { pointsEarned: MANDATORY_TASK_POINTS };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
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
}
