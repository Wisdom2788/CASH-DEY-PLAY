import { DailyTasks } from "../../entitlements/daily-tasks";
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
  claimExemptTask(userId:string,key:string): Promise<{pointsEarned:number;alreadyClaimed:boolean}>;
}

export class PostgresTasksRepository implements TasksRepository {
  constructor(private readonly pool: Pool) {}

  async getTasksState(userId: string, today: string): Promise<TasksStateRow> {
    void today;
    return new DailyTasks(this.pool).state(userId);
  }

  claimExemptTask(userId:string,key:string) {return new DailyTasks(this.pool).claim(userId,key);}

}
