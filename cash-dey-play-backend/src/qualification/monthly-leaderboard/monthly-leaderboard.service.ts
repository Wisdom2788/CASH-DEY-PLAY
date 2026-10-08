import { isEligibleForMonthlyLeaderboard } from "./monthly-leaderboard-eligibility";
import { type IMonthlyLeaderboardRepository } from "../../db/repositories/monthly-leaderboard.repository";
import { type MonthlyLeaderboardEligibilityResult } from "./monthly-leaderboard.types";
import {
  calendarMonthKeyFromIsoDate,
  type CalendarClock,
} from "../../time/lagos-calendar-clock";

export class MonthlyLeaderboardService {
  constructor(
    private readonly repository: IMonthlyLeaderboardRepository,
    private readonly clock: CalendarClock,
  ) {}

  async checkEligibility(
    userId: string,
    monthKey: string | undefined,
  ): Promise<MonthlyLeaderboardEligibilityResult> {
    const resolvedMonthKey = monthKey ?? calendarMonthKeyFromIsoDate(this.clock.todayIsoCalendarDate());
    const activity = await this.repository.getUserActivity(userId, resolvedMonthKey);
    return isEligibleForMonthlyLeaderboard(activity);
  }
}
