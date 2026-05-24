// Schedules a browser notification 15 minutes before each upcoming course.
//
// Limitations:
//   - setTimeout fires only while the page is alive (PWA in foreground, or
//     backgrounded tab on desktop). Truly closed apps need Push API + server,
//     out of scope here.
//   - On iOS PWA, background timers are aggressively throttled.

const STORAGE_KEY = "notificationsEnabled";
const LEAD_TIME_MS = 15 * 60 * 1000;
const SCHEDULE_HORIZON_MS = 24 * 60 * 60 * 1000;
const MAX_TIMERS = 32;

let timers = [];

export const isSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

export const isEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const setEnabled = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    /* quota */
  }
};

export const currentPermission = () =>
  isSupported() ? Notification.permission : "unsupported";

export const requestPermission = async () => {
  if (!isSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
};

export const clearScheduled = () => {
  timers.forEach((id) => clearTimeout(id));
  timers = [];
};

export const scheduleNotifications = (events) => {
  clearScheduled();
  if (!isEnabled() || !isSupported()) return 0;
  if (Notification.permission !== "granted") return 0;
  if (!events || !events.length) return 0;

  const now = Date.now();
  const upcoming = events
    .filter((ev) => {
      const start = new Date(ev.start).getTime();
      const triggerAt = start - LEAD_TIME_MS;
      return triggerAt > now && triggerAt - now < SCHEDULE_HORIZON_MS;
    })
    .slice(0, MAX_TIMERS);

  for (const ev of upcoming) {
    const startT = new Date(ev.start).getTime();
    const triggerAt = startT - LEAD_TIME_MS;
    const delay = triggerAt - now;
    const id = setTimeout(() => {
      try {
        const minutesUntil = Math.round((startT - Date.now()) / 60000);
        new Notification(`Cours dans ${minutesUntil} min`, {
          body: `${ev.summary || "Cours"}${ev.location ? " — " + ev.location : ""}`,
          icon: "/favicon.svg",
          tag: `course-${startT}`,
          silent: false,
        });
      } catch {
        /* ignore */
      }
    }, delay);
    timers.push(id);
  }

  return upcoming.length;
};
