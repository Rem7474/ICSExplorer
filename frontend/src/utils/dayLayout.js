import { formatDateOnly, formatTimeOnly, isAllDayEvent } from "./dates.js";

export const DEFAULT_HOUR_START = 8;
export const DEFAULT_HOUR_END = 18;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const sameDay = (a, b) => formatDateOnly(a) === formatDateOnly(b);

/** Events overlapping `day`, split into all-day banners and timed events. */
export const eventsOfDay = (events, day) => {
  const from = startOfDay(day);
  const to = endOfDay(day);
  const overlapping = events.filter((e) => new Date(e.start) <= to && new Date(e.end) >= from);
  return {
    allDay: overlapping.filter((e) => isAllDayEvent(e, day)),
    timed: overlapping.filter((e) => !isAllDayEvent(e, day)),
  };
};

/**
 * Hour range to display for a set of timed events: 8h–18h at least,
 * widened to include earlier/later courses (clamped to 7h–23h).
 */
export const hourRange = (timedEvents) => {
  if (!timedEvents.length) return { start: DEFAULT_HOUR_START, end: DEFAULT_HOUR_END };
  let start = DEFAULT_HOUR_START;
  let end = DEFAULT_HOUR_END;
  for (const e of timedEvents) {
    const s = new Date(e.start);
    const en = new Date(e.end);
    start = Math.min(start, s.getHours());
    if (sameDay(s, en)) end = Math.max(end, en.getHours() + (en.getMinutes() > 0 ? 1 : 0));
    else end = Math.max(end, s.getHours() + (s.getMinutes() > 0 ? 1 : 0) + 2);
  }
  return { start: Math.max(7, start), end: Math.min(23, end) };
};

/** Time label of an event on a given day ("08h15 - 10h15", "Jusqu'à 12h00", …). */
export const timeLabel = (event, day) => {
  const s = new Date(event.start);
  const e = new Date(event.end);
  if (sameDay(s, e)) return `${formatTimeOnly(s)} - ${formatTimeOnly(e)}`;
  if (sameDay(s, day)) return `${formatTimeOnly(s)} → ${formatDateOnly(e)} ${formatTimeOnly(e)}`;
  if (sameDay(e, day)) return `Jusqu'à ${formatTimeOnly(e)}`;
  return `${formatTimeOnly(s)} - ${formatTimeOnly(e)}`;
};

/**
 * Positions the timed events of one day: vertical offset/height from the hour
 * range, and side-by-side columns for overlapping events (events of a cluster
 * of overlaps share the width equally).
 */
export const layoutDay = (timedEvents, day, { hourStart, hourEnd, pxPerHour, minHeight = 24 }) => {
  const dayStart = new Date(day);
  dayStart.setHours(hourStart, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(hourEnd, 0, 0, 0);

  const items = timedEvents
    .map((event) => {
      const startT = Math.max(new Date(event.start).getTime(), dayStart.getTime());
      const endT = Math.min(new Date(event.end).getTime(), dayEnd.getTime());
      return { event, startT, endT };
    })
    .filter((it) => it.endT > it.startT)
    .sort((a, b) => a.startT - b.startT || b.endT - a.endT);

  const placed = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = [];
    for (const it of cluster) {
      let col = columns.findIndex((end) => end <= it.startT);
      if (col === -1) {
        col = columns.length;
        columns.push(0);
      }
      columns[col] = it.endT;
      it.col = col;
    }
    for (const it of cluster) placed.push({ ...it, cols: columns.length });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    if (cluster.length && it.startT >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endT);
  }
  if (cluster.length) flush();

  const toPx = (t) => ((t - dayStart.getTime()) / 3600000) * pxPerHour;
  return placed.map(({ event, startT, endT, col, cols }) => ({
    event,
    top: toPx(startT),
    height: Math.max(minHeight, toPx(endT) - toPx(startT)),
    col,
    cols,
    time: timeLabel(event, day),
  }));
};
