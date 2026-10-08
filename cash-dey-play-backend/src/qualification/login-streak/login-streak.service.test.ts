import { LoginStreakService } from "./login-streak.service";
import { type ILoginStreakRepository } from "../../db/repositories/login-streak.repository";
import { type IIdempotencyRepository } from "../../db/repositories/idempotency.repository";
import { type IRewardAuditRepository } from "../../db/repositories/reward-audit.repository";
import { type CalendarClock } from "../../time/lagos-calendar-clock";
import {
  LoginStreakBonusAlreadyClaimedError,
  LoginStreakNotFoundError,
  LoginStreakNotYetQualifiedError,
  type IsoCalendarDate,
  type LoginStreakState,
} from "./login-streak.types";

class FixedCalendarClock implements CalendarClock {
  constructor(private readonly isoDate: IsoCalendarDate) {}
  todayIsoCalendarDate(): IsoCalendarDate {
    return this.isoDate;
  }
}

describe("LoginStreakService", () => {
  let mockRepository: jest.Mocked<ILoginStreakRepository>;
  let mockAuditRepository: jest.Mocked<IRewardAuditRepository>;
  let mockIdempotencyRepository: jest.Mocked<IIdempotencyRepository>;
  let service: LoginStreakService;

  beforeEach(() => {
    mockRepository = {
      getState: jest.fn(),
      saveState: jest.fn(),
    };
    mockAuditRepository = {
      append: jest.fn(),
    };
    mockIdempotencyRepository = {
      find: jest.fn(),
      save: jest.fn(),
    };
    service = new LoginStreakService(
      mockRepository,
      new FixedCalendarClock("2026-07-01"),
      mockAuditRepository,
      mockIdempotencyRepository,
    );
  });

  describe("processLogin", () => {
    it("loads state, records the clock date, and persists the result", async () => {
      mockRepository.getState.mockResolvedValue(null);

      const result = await service.processLogin("user-1");

      expect(mockRepository.getState).toHaveBeenCalledWith("user-1");
      expect(mockRepository.saveState).toHaveBeenCalledWith("user-1", result.state);
      expect(result.state.lastLoginDate).toBe("2026-07-01");
      expect(result.state.consecutiveLoginDaysCount).toBe(1);
    });
  });

  describe("getProgress", () => {
    it("returns null when the user has no streak yet", async () => {
      mockRepository.getState.mockResolvedValue(null);
      await expect(service.getProgress("user-1")).resolves.toBeNull();
    });
  });

  describe("claimBonus", () => {
    const qualifiedState: LoginStreakState = {
      windowStartDate: "2026-07-01",
      lastLoginDate: "2026-07-30",
      consecutiveLoginDaysCount: 30,
      graceDaysUsed: 0,
      hasClaimedBonus: false,
    };

    it("claims a qualified streak, writes an audit row, and stores the idempotency key", async () => {
      mockIdempotencyRepository.find.mockResolvedValue(null);
      mockRepository.getState.mockResolvedValue(qualifiedState);

      const result = await service.claimBonus("user-1", "idem-key-1");

      expect(result.hasClaimedBonus).toBe(true);
      expect(mockRepository.saveState).toHaveBeenCalledWith("user-1", result);
      expect(mockAuditRepository.append).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          eventType: "login_streak_bonus_claimed",
          triggeringRule: "login-streak-engine.claimLoginStreakBonus",
        }),
      );
      expect(mockIdempotencyRepository.save).toHaveBeenCalledWith(
        "user-1",
        "POST /api/login-streak/claim",
        "idem-key-1",
        result,
      );
    });

    it("returns the cached claim without re-saving when the idempotency key is replayed", async () => {
      const alreadyClaimed: LoginStreakState = { ...qualifiedState, hasClaimedBonus: true };
      mockIdempotencyRepository.find.mockResolvedValue(alreadyClaimed);

      const result = await service.claimBonus("user-1", "idem-key-1");

      expect(result).toBe(alreadyClaimed);
      expect(mockRepository.getState).not.toHaveBeenCalled();
      expect(mockRepository.saveState).not.toHaveBeenCalled();
      expect(mockAuditRepository.append).not.toHaveBeenCalled();
    });

    it("throws LoginStreakNotFoundError when the user has never logged in", async () => {
      mockIdempotencyRepository.find.mockResolvedValue(null);
      mockRepository.getState.mockResolvedValue(null);

      await expect(service.claimBonus("user-1", "idem-key-1")).rejects.toThrow(LoginStreakNotFoundError);
      expect(mockRepository.saveState).not.toHaveBeenCalled();
      expect(mockAuditRepository.append).not.toHaveBeenCalled();
    });

    it("throws LoginStreakNotYetQualifiedError below the 30-day threshold", async () => {
      mockIdempotencyRepository.find.mockResolvedValue(null);
      mockRepository.getState.mockResolvedValue({
        windowStartDate: "2026-07-01",
        lastLoginDate: "2026-07-14",
        consecutiveLoginDaysCount: 14,
        graceDaysUsed: 0,
        hasClaimedBonus: false,
      });

      await expect(service.claimBonus("user-1", "idem-key-1")).rejects.toThrow(
        LoginStreakNotYetQualifiedError,
      );
      expect(mockRepository.saveState).not.toHaveBeenCalled();
    });

    it("throws LoginStreakBonusAlreadyClaimedError without writing a second audit row", async () => {
      mockIdempotencyRepository.find.mockResolvedValue(null);
      mockRepository.getState.mockResolvedValue({ ...qualifiedState, hasClaimedBonus: true });

      await expect(service.claimBonus("user-1", "idem-key-2")).rejects.toThrow(
        LoginStreakBonusAlreadyClaimedError,
      );
      expect(mockAuditRepository.append).not.toHaveBeenCalled();
    });
  });
});
