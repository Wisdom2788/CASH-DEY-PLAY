import { recordLogin, claimLoginStreakBonus } from "./login-streak-engine";
import {
  LOGIN_STREAK_WINDOW_LENGTH_DAYS,
  LoginStreakBonusAlreadyClaimedError,
  LoginStreakNotFoundError,
  type LoginStreakState,
  type RecordLoginResult,
} from "./login-streak.types";
import {
  LOGIN_STREAK_CLAIM_ENDPOINT,
} from "../../db/repositories/idempotency.repository";
import { type StreakUnitOfWork } from "../../db/streak-unit-of-work";
import { type CalendarClock } from "../../time/lagos-calendar-clock";

export const LOGIN_STREAK_BONUS_EVENT_TYPE = "login_streak_bonus_claimed";
export const LOGIN_STREAK_BONUS_REASON = "30-day personal login streak window completed";
export const LOGIN_STREAK_BONUS_TRIGGERING_RULE = "login-streak-engine.claimLoginStreakBonus";

export class LoginStreakService {
  constructor(private readonly clock: CalendarClock, private readonly transactions: StreakUnitOfWork) {}

  async getProgress(userId: string): Promise<LoginStreakState | null> {
    return this.transactions.run(userId, ({ streak }) => streak.getState(userId));
  }

  async processLogin(userId: string): Promise<RecordLoginResult> {
    return this.transactions.run(userId, async ({ streak }) => {
      const result = recordLogin(await streak.getState(userId), this.clock.todayIsoCalendarDate());
      await streak.saveState(userId, result.state);
      return result;
    });
  }

  async claimBonus(userId: string, idempotencyKey: string): Promise<LoginStreakState> {
    return this.transactions.run(userId, async ({ streak, idempotency, audit }) => {
      // Lock precedes cache lookup: same-key requests on different instances see the committed response.
      const cached = await idempotency.find<LoginStreakState>(userId, LOGIN_STREAK_CLAIM_ENDPOINT, idempotencyKey);
      if (cached !== null) return cached;
      const current = await streak.getState(userId);
      if (current === null) throw new LoginStreakNotFoundError(userId);
      claimLoginStreakBonus(current);
      const claimed = await streak.tryMarkBonusClaimed(userId, LOGIN_STREAK_WINDOW_LENGTH_DAYS);
      if (claimed === null) throw new LoginStreakBonusAlreadyClaimedError();
      await audit.append({
        userId, eventType: LOGIN_STREAK_BONUS_EVENT_TYPE, amountKobo: null,
        reason: LOGIN_STREAK_BONUS_REASON, triggeringRule: LOGIN_STREAK_BONUS_TRIGGERING_RULE,
      });
      await idempotency.save(userId, LOGIN_STREAK_CLAIM_ENDPOINT, idempotencyKey, claimed);
      return claimed;
    });
  }
}
