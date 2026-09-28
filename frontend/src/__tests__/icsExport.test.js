import { describe, it, expect } from "vitest";
import { escapeIcsText, foldIcsLine, buildSingleEventIcs } from "../utils/icsExport.js";

describe("icsExport", () => {
  it("escapes RFC 5545 TEXT special characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const line = `DESCRIPTION:${"é".repeat(80)}`;
    const folded = foldIcsLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("builds a valid single-event calendar with escaped fields and a stable UID", () => {
    const event = {
      summary: "TD Maths, groupe A; salle 2",
      location: "A042, A046",
      description: "Prof: DUPONT\nApporter la calculatrice",
      start: "2026-09-28T08:15:00Z",
      end: "2026-09-28T10:15:00Z",
    };
    const ics = buildSingleEventIcs(event, new Date("2026-09-01T00:00:00Z"));

    expect(ics).toContain("PRODID:-//ICSExplorer//FR");
    expect(ics).toContain("SUMMARY:TD Maths\\, groupe A\\; salle 2");
    expect(ics).toContain("LOCATION:A042\\, A046");
    expect(ics).toContain("DESCRIPTION:Prof: DUPONT\\nApporter la calculatrice");
    expect(ics).toContain("DTSTART:20260928T081500Z");
    expect(ics).toContain("DTEND:20260928T101500Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);

    // Same event -> same UID, so re-importing updates instead of duplicating.
    const uid = ics.match(/UID:(.+)/)[1];
    expect(buildSingleEventIcs(event)).toContain(`UID:${uid}`);
    expect(uid).toMatch(/@icsexplorer$/);
  });

  it("keeps the source UID when the event has one", () => {
    const ics = buildSingleEventIcs({ uid: "ADE-123", summary: "X", start: "2026-09-28T08:00:00Z", end: "2026-09-28T09:00:00Z" });
    expect(ics).toContain("UID:ADE-123\r\n");
  });

  it("exports all-day events as DATE values with an exclusive end", () => {
    const start = new Date(2026, 8, 28, 0, 0);
    const end = new Date(2026, 8, 29, 0, 0);
    const ics = buildSingleEventIcs({ summary: "Journée", start, end });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260928");
    expect(ics).toContain("DTEND;VALUE=DATE:20260929");
  });
});
