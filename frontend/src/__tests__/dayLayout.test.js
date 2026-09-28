import { describe, it, expect } from "vitest";
import { layoutDay, hourRange, eventsOfDay, timeLabel } from "../utils/dayLayout.js";

const day = new Date(2026, 8, 28); // Monday 28 Sept 2026
const at = (h, m = 0, d = 28) => new Date(2026, 8, d, h, m);
const ev = (summary, start, end) => ({ summary, start, end });

describe("dayLayout", () => {
  it("places events vertically from the hour range", () => {
    const [item] = layoutDay([ev("A", at(9), at(11))], day, { hourStart: 8, hourEnd: 18, pxPerHour: 60 });
    expect(item.top).toBe(60);
    expect(item.height).toBe(120);
    expect(item.cols).toBe(1);
    expect(item.time).toBe("09h00 - 11h00");
  });

  it("puts overlapping events side by side and keeps separate clusters full width", () => {
    const items = layoutDay(
      [ev("A", at(8), at(10)), ev("B", at(9), at(11)), ev("C", at(14), at(15))],
      day,
      { hourStart: 8, hourEnd: 18, pxPerHour: 60 }
    );
    const byName = Object.fromEntries(items.map((i) => [i.event.summary, i]));
    expect([byName.A.col, byName.B.col]).toEqual([0, 1]);
    expect(byName.A.cols).toBe(2);
    expect(byName.C.cols).toBe(1);
  });

  it("clamps events to the visible range and enforces a minimum height", () => {
    const [item] = layoutDay([ev("Short", at(7, 50), at(8, 5))], day, { hourStart: 8, hourEnd: 18, pxPerHour: 60, minHeight: 24 });
    expect(item.top).toBe(0);
    expect(item.height).toBe(24);
  });

  it("widens the hour range for early or late courses", () => {
    expect(hourRange([])).toEqual({ start: 8, end: 18 });
    expect(hourRange([ev("Early", at(7, 30), at(9)), ev("Late", at(18, 30), at(20, 15))])).toEqual({ start: 7, end: 21 });
  });

  it("splits all-day banners from timed events", () => {
    const allDay = ev("Journée", new Date(2026, 8, 28, 0, 0), new Date(2026, 8, 29, 0, 0));
    const timed = ev("Cours", at(10), at(12));
    const other = ev("Autre jour", at(10, 0, 29), at(12, 0, 29));
    const { allDay: banners, timed: courses } = eventsOfDay([allDay, timed, other], day);
    expect(banners.map((e) => e.summary)).toEqual(["Journée"]);
    expect(courses.map((e) => e.summary)).toEqual(["Cours"]);
  });

  it("labels multi-day events per day", () => {
    const multi = ev("Séminaire", at(18, 0, 28), at(15, 0, 30));
    expect(timeLabel(multi, day)).toBe("18h00 → 30/09/2026 15h00");
    expect(timeLabel(multi, new Date(2026, 8, 30))).toBe("Jusqu'à 15h00");
  });
});
