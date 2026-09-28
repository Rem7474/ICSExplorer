import { isAllDayEvent } from "./dates.js";
import { stringToHash } from "./colors.js";

/** Escapes a TEXT value per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
export const escapeIcsText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1), without splitting a
 * multi-byte UTF-8 character. Continuation lines start with a single space.
 */
export const foldIcsLine = (line) => {
  const encoder = new TextEncoder();
  const parts = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const pad = (n) => String(n).padStart(2, "0");

const toUtcStamp = (date) => new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

const toDateValue = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

/**
 * Builds a standalone VCALENDAR containing a single event. The UID is stable
 * (reuses the source UID, or derives one from the event content) so importing
 * the same course twice updates it instead of creating a duplicate.
 */
export const buildSingleEventIcs = (event, now = new Date()) => {
  const uid = event.uid || `${stringToHash(`${event.summary}|${new Date(event.start).toISOString()}`)}@icsexplorer`;

  let timing;
  if (isAllDayEvent(event)) {
    // DTEND is exclusive for all-day events: the day after the last day.
    const end = new Date(event.end);
    if (end.getHours() !== 0 || end.getMinutes() !== 0) end.setDate(end.getDate() + 1);
    timing = [`DTSTART;VALUE=DATE:${toDateValue(event.start)}`, `DTEND;VALUE=DATE:${toDateValue(end)}`];
  } else {
    timing = [`DTSTART:${toUtcStamp(event.start)}`, `DTEND:${toUtcStamp(event.end)}`];
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ICSExplorer//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(now)}`,
    ...timing,
    `SUMMARY:${escapeIcsText(event.summary || "Cours")}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};
