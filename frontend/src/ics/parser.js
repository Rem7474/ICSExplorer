export const parseIcsDate = (dateStr) => {
  if (!dateStr) return null;
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return null;

  const [, y, m, d, hh = "00", mm = "00", ss = "00"] = match;

  if (dateStr.endsWith("Z")) {
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
  }
  return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
};

export const parseIcs = (icsText) => {
  if (!icsText) return [];

  // Unfold lines
  const lines = [];
  const rawLines = icsText.split(/\r\n|\n|\r/);
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.trim() !== "") {
      lines.push(line);
    }
  }

  const events = [];
  let currentEvent = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const keyPart = line.slice(0, colonIdx);
        const value = line.slice(colonIdx + 1);
        const key = keyPart.split(";")[0].toUpperCase();

        if (key === "SUMMARY") {
          currentEvent.summary = value.replace(/\\,/g, ",").replace(/\\n/g, " ");
        } else if (key === "LOCATION") {
          currentEvent.location = value.replace(/\\,/g, ",").replace(/\\n/g, " ");
        } else if (key === "DESCRIPTION") {
          currentEvent.description = value.replace(/\\,/g, ",").replace(/\\n/g, "\n");
        } else if (key === "DTSTART") {
          currentEvent.start = parseIcsDate(value);
        } else if (key === "DTEND") {
          currentEvent.end = parseIcsDate(value);
        } else if (key === "UID") {
          currentEvent.uid = value;
        } else if (key === "CATEGORIES") {
          currentEvent.categories = value;
          if (value.toUpperCase().includes("CERCLE")) {
            currentEvent.isCercle = true;
          }
        } else if (key === "X-SOURCE") {
          currentEvent.source = value;
          if (value.toUpperCase().includes("CERCLE")) {
            currentEvent.isCercle = true;
          }
        }
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
};

export const extractTeacherNames = (description) => {
  if (!description) return [];
  const lines = description.split("\n");
  const names = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: "avec M. Dupont, ..."
    if (trimmed.toLowerCase().includes("avec ")) {
      const idx = trimmed.toLowerCase().indexOf("avec ");
      const afterAvec = trimmed.slice(idx + 5);
      const teacherPart = afterAvec.split(",")[0].split("(")[0].trim();
      if (teacherPart && !teacherPart.toLowerCase().includes("eleves") && !teacherPart.toLowerCase().includes("étudiants")) {
        names.push(teacherPart);
      }
    }

    // Pattern 2: "Intervenant(s) : ...", "Enseignant(s) : ...", "Professeur(s) : ..."
    const prefixMatch = trimmed.match(/^(?:enseignants?|intervenants?|professeurs?|prof)\s*:\s*(.+)$/i);
    if (prefixMatch) {
      const rawList = prefixMatch[1];
      const parts = rawList.split(/[,;]/);
      for (const part of parts) {
        const clean = part.split("(")[0].trim();
        if (clean && !clean.toLowerCase().includes("eleves") && !clean.toLowerCase().includes("étudiants")) {
          names.push(clean);
        }
      }
    }
  }

  return [...new Set(names)];
};

