import { DailyTasks } from "../../entitlements/daily-tasks";
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
  claimExemptTask(userId:string,key:string): Promise<{pointsEarned:number;alreadyClaimed:boolean}>;
  completeTask(userId: string, taskId: string, today: string): Promise<{ pointsEarned: number }>;
  recordOptionalVideo(userId: string, today: string): Promise<{ success: boolean; practiceMatches: number }>;
}

export class PostgresTasksRepository implements TasksRepository {
  constructor(private readonly pool: Pool) {}

  async getTasksState(userId: string, today: string): Promise<TasksStateRow> {
    void today;
    return new DailyTasks(this.pool).state(userId);
  }

  claimExemptTask(userId:string,key:string) {return new DailyTasks(this.pool).claim(userId,key);}

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
