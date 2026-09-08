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

export const isAllDayEvent = (event, dayDate = null) => {
  if (!event || !event.start || !event.end) return false;
  if (event.allDay || event.isAllDay) return true;
  const s = new Date(event.start);
  const e = new Date(event.end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return false;

  const isMidnightStart = s.getHours() === 0 && s.getMinutes() === 0;
  const isMidnightEnd =
    (e.getHours() === 0 && e.getMinutes() === 0) ||
    (e.getHours() === 23 && e.getMinutes() >= 59);
  const durationHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);

  // Pure all-day event: starts at midnight and ends at midnight/23:59 with duration >= 23h
  if (isMidnightStart && isMidnightEnd && durationHours >= 23) {
    return true;
  }

  // If a reference day is provided, evaluate whether this specific day acts as an all-day / banner slot
  if (dayDate) {
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const isStartDay = formatDateOnly(s) === formatDateOnly(dayDate);
    const isEndDay = formatDateOnly(e) === formatDateOnly(dayDate);

    // On start day: if it has a non-midnight start time (e.g. 13h30, 18h00), it is a TIMED event!
    if (isStartDay && !isMidnightStart) {
      return false;
    }

    // On intermediate full days (event began before today and continues past today): full day banner
    if (s < dayStart && e > dayEnd) {
      return true;
    }

    // On end day: if it started before today and ends late (>= 18h) or midnight
    if (isEndDay && s < dayStart) {
      const endHour = e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
      if (endHour >= 18 || isMidnightEnd) {
        return true;
      }
      return false;
    }

    // Single-day events that don't start at midnight are never all-day
    if (isStartDay && isEndDay && !isMidnightStart) {
      return false;
    }
  }

  // Fallback if no dayDate: only pure midnight-to-midnight multi-day events are strictly all-day
  return isMidnightStart && durationHours >= 23;
};
