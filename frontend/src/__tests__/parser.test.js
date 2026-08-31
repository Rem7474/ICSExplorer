import { describe, it, expect } from "vitest";
import { parseIcs, parseIcsDate, extractTeacherNames } from "../ics/parser.js";
import { cleanMojibake } from "../ics/api.js";

describe("ICS parser", () => {
  it("cleans double UTF-8 mojibake strings properly", () => {
    const input = "DÃ©jeuner 3A - SoirÃ©e inter-assos";
    const expected = "Déjeuner 3A - Soirée inter-assos";
    expect(cleanMojibake(input)).toBe(expected);
  });

  it("parses valid ICS date format", () => {
    const d = parseIcsDate("20260901T083000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(8); // Sep
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(8);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it("parses standard VEVENT blocks into event objects", () => {
    const rawICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-101
SUMMARY:IN101 Informatique
LOCATION:A166
DESCRIPTION:Maths en TD1 avec M. Dupont\\nExport
DTSTART:20260901T083000Z
DTEND:20260901T103000Z
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(rawICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("IN101 Informatique");
    expect(events[0].location).toBe("A166");
    expect(events[0].uid).toBe("evt-101");
    expect(events[0].description).toBe("Maths en TD1 avec M. Dupont\nExport");
  });

  it("extracts teacher names from description", () => {
    const desc = "Informatique en TP1 avec M. Durand, Salle A042\nKholle avec Mme Martin";
    const teachers = extractTeacherNames(desc);
    expect(teachers).toContain("M. Durand");
    expect(teachers).toContain("Mme Martin");
  });
});
