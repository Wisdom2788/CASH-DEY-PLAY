import {
  calendarMonthKeyFromIsoDate,
  formatIsoCalendarDateInTimeZone,
  InvalidCalendarMonthError,
  NIGERIA_TIME_ZONE,
  startOfCalendarMonth,
  startOfNextCalendarMonth,
} from "./lagos-calendar-clock";

describe("formatIsoCalendarDateInTimeZone", () => {
  it("returns the Lagos calendar date for a UTC instant still on the same morning", () => {
    const instant = new Date("2026-07-01T00:30:00.000Z");
    expect(formatIsoCalendarDateInTimeZone(instant, NIGERIA_TIME_ZONE)).toBe("2026-07-01");
  });

  it("rolls to the next Lagos calendar day after 23:00 UTC (00:00+ in WAT)", () => {
    const instant = new Date("2026-07-01T23:30:00.000Z");
    expect(formatIsoCalendarDateInTimeZone(instant, NIGERIA_TIME_ZONE)).toBe("2026-07-02");
  });
});

describe("calendar month helpers", () => {
  it("derives YYYY-MM from an ISO calendar date", () => {
    expect(calendarMonthKeyFromIsoDate("2026-07-18")).toBe("2026-07");
  });

  it("returns the first day of the month and the exclusive next-month bound", () => {
    expect(startOfCalendarMonth("2026-07")).toBe("2026-07-01");
    expect(startOfNextCalendarMonth("2026-07")).toBe("2026-08-01");
  });

  it("rolls December into the next year", () => {
    expect(startOfNextCalendarMonth("2026-12")).toBe("2027-01-01");
  });

  it("rejects a malformed or out-of-range month key", () => {
    expect(() => startOfCalendarMonth("2026-7")).toThrow(InvalidCalendarMonthError);
    expect(() => startOfNextCalendarMonth("2026-13")).toThrow(InvalidCalendarMonthError);
  });
});
