export const padZero = (n) => String(n).padStart(2, "0");

export const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()} à ${padZero(d.getHours())}h${padZero(d.getMinutes())}`;
};

export const formatDateOnly = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const formatTimeOnly = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${padZero(d.getHours())}h${padZero(d.getMinutes())}`;
};

export const getWeekStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Monday = 1, Sunday = 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const getWeekEnd = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 4); // Friday
  d.setHours(23, 59, 59, 999);
  return d;
};

export const getRelevantWeekStart = (events) => {
  const now = new Date();
  const currentWeekMonday = getWeekStart(now);

  if (!events || !events.length) return currentWeekMonday;

  // Filter future events
  const futureEvents = events.filter((e) => new Date(e.end) > now);
  if (!futureEvents.length) {
    // If all events in past, return week of the last event
    const lastEvent = events[events.length - 1];
    return getWeekStart(new Date(lastEvent.start));
  }

  const nextEvent = futureEvents[0];
  const nextEventWeek = getWeekStart(new Date(nextEvent.start));

  // If next event is in future week or current week
  return nextEventWeek.getTime() >= currentWeekMonday.getTime()
    ? nextEventWeek
    : currentWeekMonday;
};

export const isAllDayEvent = (event) => {
  if (!event || !event.start || !event.end) return false;
  if (event.allDay || event.isAllDay) return true;
  const s = new Date(event.start);
  const e = new Date(event.end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return false;

  const durationHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
  if (durationHours >= 14) return true;

  return formatDateOnly(s) !== formatDateOnly(e) && durationHours >= 12;
};
