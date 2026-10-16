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

  it("extracts multiple teachers separated by commas after avec", () => {
    const desc = "Électronique en TD avec BARBOT Nicolas, DUPONT Jean\nKholle avec MARTIN Paul, de 1A";
    const teachers = extractTeacherNames(desc);
    expect(teachers).toContain("BARBOT Nicolas");
    expect(teachers).toContain("DUPONT Jean");
    expect(teachers).toContain("MARTIN Paul");
    expect(teachers).not.toContain("de 1A");
  });

  it("extracts teachers listed alone on raw ADE description lines", () => {
    const desc = "\n\nM2-IMESS-Gr1\nBRUN Emmanuel\nLEMAITRE AUGER Pierre\n* TEYSSIER Bruno\nAKTOUF Oum-El-Kheir\n(Exporté le:29/09/2026 07:50)\n";
    expect(extractTeacherNames(desc)).toEqual([
      "BRUN Emmanuel",
      "LEMAITRE AUGER Pierre",
      "TEYSSIER Bruno",
      "AKTOUF Oum-El-Kheir",
    ]);
  });

  it("drops ADE placeholders and group codes from teacher names", () => {
    const desc = "Cours avec * VAC_MAC, * Surveillant, AHN1, * LANYON  Rosina\nG1\n* Surveillant Esisar";
    expect(extractTeacherNames(desc)).toEqual(["LANYON Rosina"]);
  });

  it("rejects Unix epoch 1970 dates and inverted dates in parseIcs", () => {
    expect(parseIcsDate("19700101T000000Z")).toBeNull();

    const badICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-bad-1970
SUMMARY:Projet Ancien
DTSTART:19700101T000000Z
DTEND:20261125T031500Z
END:VEVENT
BEGIN:VEVENT
UID:evt-bad-inverted
SUMMARY:Inverted Dates
DTSTART:20260902T100000Z
DTEND:20260902T080000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-good
SUMMARY:Cours Valide
DTSTART:20260902T080000Z
DTEND:20260902T100000Z
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(badICS);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("evt-good");
  });

  it("auto-corrects 1-year start date typo from ADE and discards aberrant durations", () => {
    const typoICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-typo-1year
SUMMARY:LV510 Anglais
LOCATION:A046
DTSTART:20260204T091500Z
DTEND:20270204T104500Z
END:VEVENT
BEGIN:VEVENT
UID:evt-huge-duration
SUMMARY:Stage Infini
DTSTART:20260101T080000Z
DTEND:20260601T180000Z
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(typoICS);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("evt-typo-1year");
    expect(events[0].start.getUTCFullYear()).toBe(2027);
    expect(events[0].start.getUTCMonth()).toBe(1); // Feb
    expect(events[0].start.getUTCDate()).toBe(4);
    expect(events[0].end.getUTCFullYear()).toBe(2027);
  });

  it("auto-corrects 1-year end date typo and multi-day course spans from ADE", () => {
    const icsText = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-end-typo
SUMMARY:Maths
DTSTART:20270115T080000Z
DTEND:20260115T100000Z
END:VEVENT
BEGIN:VEVENT
UID:evt-multiday-span
SUMMARY:IN530
DTSTART:20261204T123000Z
DTEND:20261208T141500Z
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(icsText);
    expect(events).toHaveLength(2);

    const endTypo = events.find((e) => e.uid === "evt-end-typo");
    expect(endTypo).toBeDefined();
    expect(endTypo.end.getUTCFullYear()).toBe(2027);

    const multiDay = events.find((e) => e.uid === "evt-multiday-span");
    expect(multiDay).toBeDefined();
    expect(multiDay.end.getUTCDate()).toBe(4); // Corrected to Dec 4 same day as start
    expect(multiDay.end.getUTCHours()).toBe(14);
    expect(multiDay.end.getUTCMinutes()).toBe(15);
  });
});

