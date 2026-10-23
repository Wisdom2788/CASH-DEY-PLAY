import { recordLogin, claimLoginStreakBonus } from "./login-streak-engine";
import {
  LOGIN_STREAK_WINDOW_LENGTH_DAYS,
  LoginStreakBonusAlreadyClaimedError,
  LoginStreakNotFoundError,
  type LoginStreakState,
  type RecordLoginResult,
} from "./login-streak.types";
import { type ILoginStreakRepository } from "../../db/repositories/login-streak.repository";
import {
  LOGIN_STREAK_CLAIM_ENDPOINT,
  type IIdempotencyRepository,
} from "../../db/repositories/idempotency.repository";
import { type IRewardAuditRepository } from "../../db/repositories/reward-audit.repository";
import { type CalendarClock } from "../../time/lagos-calendar-clock";

export const LOGIN_STREAK_BONUS_EVENT_TYPE = "login_streak_bonus_claimed";
export const LOGIN_STREAK_BONUS_REASON = "30-day personal login streak window completed";
export const LOGIN_STREAK_BONUS_TRIGGERING_RULE = "login-streak-engine.claimLoginStreakBonus";

export class LoginStreakService {
  /** Identical claim requests that overlap in time share one run (same player and same Idempotency-Key). */
  private readonly claimsInFlight = new Map<string, Promise<LoginStreakState>>();

  constructor(
    private readonly repository: ILoginStreakRepository,
    private readonly clock: CalendarClock,
    private readonly rewardAuditRepository: IRewardAuditRepository,
    private readonly idempotencyRepository: IIdempotencyRepository,
  ) {}

  async getProgress(userId: string): Promise<LoginStreakState | null> {
    return this.repository.getState(userId);
  }

  async processLogin(userId: string): Promise<RecordLoginResult> {
    const loginDate = this.clock.todayIsoCalendarDate();
    const previousState = await this.repository.getState(userId);
    const result = recordLogin(previousState, loginDate);
    await this.repository.saveState(userId, result.state);
    return result;
  }

  async claimBonus(userId: string, idempotencyKey: string): Promise<LoginStreakState> {
    const flightKey = `${userId}|${idempotencyKey}`;
    const running = this.claimsInFlight.get(flightKey);
    if (running !== undefined) {
      return running;
    }
    const attempt = this.claimBonusOnce(userId, idempotencyKey).finally(() => {
      this.claimsInFlight.delete(flightKey);
    });
    this.claimsInFlight.set(flightKey, attempt);
    return attempt;
  }

  private async claimBonusOnce(userId: string, idempotencyKey: string): Promise<LoginStreakState> {
    const cachedClaim = await this.idempotencyRepository.find<LoginStreakState>(
      userId,
      LOGIN_STREAK_CLAIM_ENDPOINT,
      idempotencyKey,
    );
    if (cachedClaim !== null) {
      return cachedClaim;
    }

    const currentState = await this.repository.getState(userId);
    if (currentState === null) {
      throw new LoginStreakNotFoundError(userId);
    }

    // Pure rule check: throws "not yet qualified" or "already claimed" with the right error type.
    claimLoginStreakBonus(currentState);

    // The ONE step that decides who wins a race: a conditional update in the database.
    // Two simultaneous claims can both pass the check above, but only one gets a row back here.
    const claimedState = await this.repository.tryMarkBonusClaimed(userId, LOGIN_STREAK_WINDOW_LENGTH_DAYS);
    if (claimedState === null) {
      throw new LoginStreakBonusAlreadyClaimedError();
    }

    await this.rewardAuditRepository.append({
      userId,
      eventType: LOGIN_STREAK_BONUS_EVENT_TYPE,
      amountKobo: null,
      reason: LOGIN_STREAK_BONUS_REASON,
      triggeringRule: LOGIN_STREAK_BONUS_TRIGGERING_RULE,
    });
    await this.idempotencyRepository.save(
      userId,
      LOGIN_STREAK_CLAIM_ENDPOINT,
      idempotencyKey,
      claimedState,
    );
    return claimedState;
  }
}
