export const LOGIN_STREAK_WINDOW_LENGTH_DAYS = 30;
export const LOGIN_STREAK_MAX_GRACE_DAYS = 1;

export type IsoCalendarDate = string;

export interface LoginStreakState {
  readonly windowStartDate: IsoCalendarDate;
  readonly lastLoginDate: IsoCalendarDate;
  readonly consecutiveLoginDaysCount: number;
  readonly graceDaysUsed: number;
  readonly hasClaimedBonus: boolean;
}

export interface RecordLoginResult {
  readonly state: LoginStreakState;
  readonly wasReset: boolean;
  readonly graceDayConsumedToday: boolean;
  readonly qualifiesForBonus: boolean;
}

export class InvalidLoginDateError extends Error {
  constructor(public readonly providedDate: string) {
    super(`Invalid login date "${providedDate}". Expected strict ISO calendar format YYYY-MM-DD.`);
    this.name = "InvalidLoginDateError";
  }
}

export class BackdatedLoginError extends Error {
  constructor(
    public readonly providedDate: IsoCalendarDate,
    public readonly lastLoginDate: IsoCalendarDate,
  ) {
    super(`Login date "${providedDate}" is earlier than the last recorded login "${lastLoginDate}".`);
    this.name = "BackdatedLoginError";
  }
}

export class LoginStreakNotYetQualifiedError extends Error {
  constructor(public readonly state: LoginStreakState) {
    super(
      `Cannot claim login streak bonus: only ${state.consecutiveLoginDaysCount} of ${LOGIN_STREAK_WINDOW_LENGTH_DAYS} required days completed.`,
    );
    this.name = "LoginStreakNotYetQualifiedError";
  }
}

export class LoginStreakBonusAlreadyClaimedError extends Error {
  constructor() {
    super("Login streak bonus has already been claimed for this window.");
    this.name = "LoginStreakBonusAlreadyClaimedError";
  }
}

export class LoginStreakNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`No login streak exists for user "${userId}".`);
    this.name = "LoginStreakNotFoundError";
  }
}
