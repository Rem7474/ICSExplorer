import { describe, it, expect } from "vitest";
import { formatDateTime, formatDateOnly, formatTimeOnly, getWeekStart, getWeekEnd, getRelevantWeekStart } from "../utils/dates.js";

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
});
