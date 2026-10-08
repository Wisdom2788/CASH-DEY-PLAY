import { type IsoCalendarDate } from "../qualification/login-streak/login-streak.types";

export const NIGERIA_TIME_ZONE = "Africa/Lagos";

export class InvalidCalendarMonthError extends Error {
  constructor(public readonly providedMonth: string) {
    super(`Invalid calendar month "${providedMonth}". Expected YYYY-MM with month 01–12.`);
    this.name = "InvalidCalendarMonthError";
  }
}

export interface CalendarClock {
  todayIsoCalendarDate(): IsoCalendarDate;
}

export function formatIsoCalendarDateInTimeZone(instant: Date, timeZone: string): IsoCalendarDate {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

  return formatted;
}

export class LagosCalendarClock implements CalendarClock {
  todayIsoCalendarDate(): IsoCalendarDate {
    return formatIsoCalendarDateInTimeZone(new Date(), NIGERIA_TIME_ZONE);
  }
}

const CALENDAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function calendarMonthKeyFromIsoDate(date: IsoCalendarDate): string {
  return date.slice(0, 7);
}

export function assertCalendarMonthKey(monthKey: string): void {
  if (!CALENDAR_MONTH_PATTERN.test(monthKey)) {
    throw new InvalidCalendarMonthError(monthKey);
  }

  const monthNumber = Number(monthKey.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) {
    throw new InvalidCalendarMonthError(monthKey);
  }
}

export function startOfCalendarMonth(monthKey: string): IsoCalendarDate {
  assertCalendarMonthKey(monthKey);
  return `${monthKey}-01`;
}

export function startOfNextCalendarMonth(monthKey: string): IsoCalendarDate {
  assertCalendarMonthKey(monthKey);
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const nextMonthUtc = new Date(Date.UTC(year, month, 1));
  return nextMonthUtc.toISOString().slice(0, 10);
}
