import { describe, it, expect } from "vitest";
import { formatDateTime, formatDateOnly, formatTimeOnly, getWeekStart, getWeekEnd, getRelevantWeekStart, isAllDayEvent } from "../utils/dates.js";

describe("dates utils", () => {
  it("formats date and time correctly", () => {
    const d = new Date(2026, 8, 1, 14, 30, 0); // 1 Sep 2026 14:30
    expect(formatDateOnly(d)).toBe("01/09/2026");
    expect(formatTimeOnly(d)).toBe("14h30");
    expect(formatDateTime(d)).toBe("01/09/2026 à 14h30");
  });

  it("calculates week start (Monday) and week end (Friday)", () => {
    const wednesday = new Date(2026, 8, 2); // 2 Sep 2026 (Wednesday)
    const monday = getWeekStart(wednesday);
    expect(monday.getDate()).toBe(31); // 31 Aug 2026
    expect(monday.getMonth()).toBe(7); // August (0-indexed 7)

    const friday = getWeekEnd(monday);
    expect(friday.getDate()).toBe(4); // 4 Sep 2026
  });

  it("returns relevant week start for events list", () => {
    const events = [
      { start: new Date(2026, 8, 10, 8, 0, 0), end: new Date(2026, 8, 10, 10, 0, 0) },
    ];
    const relevant = getRelevantWeekStart(events);
    expect(relevant).toBeInstanceOf(Date);
  });

  it("identifies all-day and multi-day events correctly with isAllDayEvent", () => {
    const wednesday = new Date(2026, 8, 2);
    const thursday = new Date(2026, 8, 3);
    const friday = new Date(2026, 8, 4);

    // 2-hour timed course (same day)
    const timedCourse = { start: new Date(2026, 8, 2, 8, 0), end: new Date(2026, 8, 2, 10, 0) };
    expect(isAllDayEvent(timedCourse, wednesday)).toBe(false);
    expect(isAllDayEvent(timedCourse)).toBe(false);

    // Full day 10h course (same day)
    const fullDayCourse = { start: new Date(2026, 8, 2, 8, 0), end: new Date(2026, 8, 2, 18, 0) };
    expect(isAllDayEvent(fullDayCourse, wednesday)).toBe(false);
    expect(isAllDayEvent(fullDayCourse)).toBe(false);

    // Afternoon slot EP530 (13h30 - 15h15)
    const ep530 = { start: new Date(2026, 8, 18, 13, 30), end: new Date(2026, 8, 18, 15, 15) };
    const fri18 = new Date(2026, 8, 18);
    expect(isAllDayEvent(ep530, fri18)).toBe(false);
    expect(isAllDayEvent(ep530)).toBe(false);

    // WEI starting Friday at 18:00 and ending Sunday at 15:00
    const wei = { start: new Date(2026, 8, 18, 18, 0), end: new Date(2026, 8, 20, 15, 0) };
    const sat19 = new Date(2026, 8, 19);
    // Friday: timed start at 18:00 (NOT in all-day banner)
    expect(isAllDayEvent(wei, fri18)).toBe(false);
    // Saturday: full intermediate day -> in all-day banner
    expect(isAllDayEvent(wei, sat19)).toBe(true);

    // Multi-day project AU530 (Wed to Fri = 48h)
    const au530 = { start: new Date(2026, 8, 2, 8, 0), end: new Date(2026, 8, 4, 18, 0) };
    expect(isAllDayEvent(au530, wednesday)).toBe(false); // start day timed
    expect(isAllDayEvent(au530, thursday)).toBe(true); // intermediate day all-day banner
    expect(isAllDayEvent(au530, friday)).toBe(true); // end day late finish all-day banner

    // Explicit 24h all-day event (starts at midnight)
    const allDayEvent = { start: new Date(2026, 8, 2, 0, 0), end: new Date(2026, 8, 3, 0, 0) };
    expect(isAllDayEvent(allDayEvent)).toBe(true);
    expect(isAllDayEvent(allDayEvent, wednesday)).toBe(true);
  });
});
