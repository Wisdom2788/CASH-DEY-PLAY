import { MonthlyLeaderboardService } from "./monthly-leaderboard.service";
import { type IMonthlyLeaderboardRepository } from "../../db/repositories/monthly-leaderboard.repository";
import { type CalendarClock } from "../../time/lagos-calendar-clock";
import { InvalidEligibilityInputError } from "./monthly-leaderboard.types";

class FixedCalendarClock implements CalendarClock {
  constructor(private readonly isoDate: string) {}
  todayIsoCalendarDate(): string {
    return this.isoDate;
  }
}

describe("MonthlyLeaderboardService", () => {
  let mockRepository: jest.Mocked<IMonthlyLeaderboardRepository>;
  let service: MonthlyLeaderboardService;

  beforeEach(() => {
    mockRepository = {
      getUserActivity: jest.fn(),
    };
    service = new MonthlyLeaderboardService(mockRepository, new FixedCalendarClock("2026-07-18"));
  });

  it("returns eligible if the activity meets requirements", async () => {
    mockRepository.getUserActivity.mockResolvedValue({
      distinctTaskCompletionDays: 20,
      totalMatchWins: 15,
    });

    const result = await service.checkEligibility("user-1", "2026-07");

    expect(mockRepository.getUserActivity).toHaveBeenCalledWith("user-1", "2026-07");
    expect(result.isEligible).toBe(true);
    expect(result.meetsTaskDayRequirement).toBe(true);
    expect(result.meetsMatchWinRequirement).toBe(true);
  });

  it("uses the clock's current Lagos month when no month is provided", async () => {
    mockRepository.getUserActivity.mockResolvedValue({
      distinctTaskCompletionDays: 0,
      totalMatchWins: 0,
    });

    await service.checkEligibility("user-1", undefined);

    expect(mockRepository.getUserActivity).toHaveBeenCalledWith("user-1", "2026-07");
  });

  it("returns not eligible if activity falls short", async () => {
    mockRepository.getUserActivity.mockResolvedValue({
      distinctTaskCompletionDays: 19,
      totalMatchWins: 15,
    });

    const result = await service.checkEligibility("user-1", "2026-07");
    expect(result.isEligible).toBe(false);
  });

  it("propagates InvalidEligibilityInputError from the engine", async () => {
    mockRepository.getUserActivity.mockResolvedValue({
      distinctTaskCompletionDays: -1,
      totalMatchWins: 15,
    });

    await expect(service.checkEligibility("user-1", "2026-07")).rejects.toThrow(
      InvalidEligibilityInputError,
    );
  });
});
