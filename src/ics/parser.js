const decodeIcsValue = (value) => {
  if (!value) return value;
  return value
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
};

export const parseIcsDate = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, "");
  if (/^\d{8}$/.test(cleaned)) {
    return new Date(
      `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00`
    );
  }
  if (/^\d{8}T\d{6}Z$/.test(cleaned)) {
    return new Date(
      `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}Z`
    );
  }
  if (/^\d{8}T\d{6}$/.test(cleaned)) {
    return new Date(
      `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}`
    );
  }
  return cleaned;
};

export const parseIcs = (icsText) => {
  const events = [];
  const lines = icsText
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  let current = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    switch (key) {
      case "SUMMARY":
        current.summary = decodeIcsValue(value);
        break;
      case "DTSTART":
        current.start = parseIcsDate(value);
        break;
      case "DTEND":
        current.end = parseIcsDate(value);
        break;
      case "LOCATION":
        current.location = decodeIcsValue(value);
        break;
      case "DESCRIPTION":
        current.description = decodeIcsValue(value);
        break;
      case "UID":
        current.uid = value;
        break;
      default:
        break;
    }
  }

  return events
    .filter((event) => event.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
};

export const extractTeacherNames = (description) => {
  if (!description) return [];
  const match = description.match(/\bavec\b\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && !name.startsWith("*"))
    .map((name) => name.replace(/^\*+\s*/, "").trim())
    .filter(Boolean);
};

export const generateIcsEvent = (event) => {
  const formatIcsDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Edt Esisar//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatIcsDate(event.start)}
DTEND:${formatIcsDate(event.end)}
SUMMARY:${event.summary || "Événement"}
LOCATION:${event.location || ""}
DESCRIPTION:${event.description || ""}
END:VEVENT
END:VCALENDAR`;
};
