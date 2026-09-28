// Pure helpers for the Rechercher screen: quick search across every schedule
// and grouping of the browse lists.

export const MIN_QUERY_LENGTH = 2;

const normalize = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Matches promos, teachers and rooms containing the query (accents and case
 * ignored). Promos come first, then teachers, then rooms.
 */
export const searchSchedules = ({ files = [], teachers = [], rooms = [] }, query, limit = 12) => {
  const q = normalize(query.trim());
  if (q.length < MIN_QUERY_LENGTH) return [];
  const results = [];
  for (const file of files) {
    if (typeof file !== "string") continue;
    const label = file.replace(/\.ics$/i, "");
    if (normalize(label).includes(q)) results.push({ type: "student", label, value: file });
  }
  for (const teacher of teachers) {
    if (typeof teacher === "string" && normalize(teacher).includes(q)) results.push({ type: "teacher", label: teacher, value: teacher });
  }
  for (const room of rooms) {
    if (typeof room === "string" && normalize(room).includes(q)) results.push({ type: "room", label: `Salle ${room}`, value: room });
  }
  return results.slice(0, limit);
};

/** Short promo name inside its year/track group: "TP A" for 1A-Info-TP-A.ics. */
export const promoLabel = (f) => [f.type, f.rest].filter(Boolean).join(" ") || f.fileName.replace(/\.ics$/i, "");

/** Groups items into [{ key, items }] in first-seen order. */
export const groupBy = (items, keyOf) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups].map(([key, list]) => ({ key, items: list }));
};

/** First letter used as a section header for teachers ("#" for non letters). */
export const initialOf = (name) => {
  const c = normalize(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

/** Building of a room ("A042" → "A"), "Autres" when it doesn't start with a letter. */
export const buildingOf = (room) => {
  const c = String(room).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "Autres";
};
