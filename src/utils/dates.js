export const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
};

export const formatTimeOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getWeekStart = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getWeekEnd = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Returns the week start of the next event that hasn't ended yet. Falls back
// to the current week if no upcoming events exist. This skips empty weeks
// (vacations, end-of-week after Friday's last course is done, etc.).
export const getRelevantWeekStart = (events, now = new Date()) => {
  const weekStart = getWeekStart(now);
  if (!events || !events.length) return weekStart;

  let nextEvent = null;
  let nextStartT = Infinity;
  for (const ev of events) {
    const end = new Date(ev.end);
    if (end <= now) continue;
    const startT = new Date(ev.start).getTime();
    if (startT < nextStartT) {
      nextStartT = startT;
      nextEvent = ev;
    }
  }

  if (nextEvent) return getWeekStart(nextEvent.start);
  return weekStart;
};
