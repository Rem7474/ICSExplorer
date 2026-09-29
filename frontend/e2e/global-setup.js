// Generates deterministic test calendars in e2e/.data before the run. Events
// are placed in the current week (Monday–Friday) so tests never depend on the
// date they run on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, ".data");

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

const monday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
};

const at = (dayOffset, hour, minute = 0) => {
  const d = monday();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const calendar = (name, events) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//ICSExplorer e2e//${name}//FR`,
    ...events.flatMap((e, i) => [
      "BEGIN:VEVENT",
      `UID:e2e-${name}-${i}@icsexplorer`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${e.summary}`,
      `LOCATION:${e.location}`,
      `DESCRIPTION:${e.description}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");

export const FIXTURE = {
  promoA: "1A-Test-TP-A.ics",
  promoB: "3A-IR-TD-1.ics",
  room: "A042",
  teacher: "DUPONT Jean",
  courseA: "IN101",
  courseB: "MT301",
};

export default function globalSetup() {
  const output = path.join(DATA_DIR, "output");
  const rooms = path.join(DATA_DIR, "rooms");
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(rooms, { recursive: true });

  const promoAEvents = [0, 1, 2, 3, 4].flatMap((day) => [
    { start: at(day, 8, 15), end: at(day, 10, 15), summary: FIXTURE.courseA, location: FIXTURE.room, description: `Algorithmique en TD avec ${FIXTURE.teacher}` },
    { start: at(day, 13, 30), end: at(day, 15, 30), summary: "EP102", location: "B040", description: "Electronique en TP avec MARTIN Paul" },
  ]);
  const promoBEvents = [0, 2, 4].map((day) => ({
    start: at(day, 10, 30),
    end: at(day, 12, 30),
    summary: FIXTURE.courseB,
    location: "C101",
    description: `Mathematiques en CM avec ${FIXTURE.teacher}`,
  }));

  // RU menus (same shape as internal/crous/ics.go), shown on top of schedules.
  const ruEvents = [0, 1, 2, 3, 4].map((day) => ({
    start: at(day, 12, 0),
    end: at(day, 13, 0),
    summary: "🍽️ RU Briff'O",
    location: "RU Briff'O (Valence)",
    description: "🍽️ Saveurs du Jour :\\n• Curry de légumes\\n• Saucisses sauce moutarde\\n• Riz de Camargue\\n\\n🍝 Pâtes :\\n• Penne sauce reblochon",
  }));
  fs.writeFileSync(path.join(output, "ru.ics"), calendar("ru", ruEvents).replace(/END:VEVENT/g, "CATEGORIES:RU,CROUS\r\nEND:VEVENT"));

  fs.writeFileSync(path.join(output, FIXTURE.promoA), calendar("promoA", promoAEvents));
  fs.writeFileSync(path.join(output, FIXTURE.promoB), calendar("promoB", promoBEvents));
  fs.writeFileSync(path.join(output, "files.json"), JSON.stringify([FIXTURE.promoA, FIXTURE.promoB]));
  fs.writeFileSync(
    path.join(rooms, `${FIXTURE.room}.ics`),
    calendar("room", promoAEvents.filter((e) => e.location === FIXTURE.room))
  );
}
