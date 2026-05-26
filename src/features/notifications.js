// Schedules a notification 15 minutes before each upcoming course.
//
// Display strategy:
//   - Preferred: ServiceWorkerRegistration.showNotification()
//       The only API supported by iOS PWAs (16.4+), and the only reliable way
//       to fire notifications when the page is backgrounded on Android.
//   - Fallback: new Notification() (older browsers, desktop without SW)
//
// Limitations:
//   - setTimeout fires only while the page/PWA is alive in memory. A truly
//     closed PWA needs Push API + a server, out of scope here.
//   - On iOS PWA, background timers are throttled aggressively but the app
//     stays warm for a few minutes after backgrounding.

const STORAGE_KEY = "notificationsEnabled";
const LEAD_TIME_MS = 15 * 60 * 1000;
const SCHEDULE_HORIZON_MS = 24 * 60 * 60 * 1000;
const MAX_TIMERS = 32;

let timers = [];
let swRegistration = null;

export const setRegistration = (registration) => {
  swRegistration = registration || null;
};

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

// Try to grab the ready SW registration if we don't have one yet.
// Resolves silently on failure so the caller can fall back.
const ensureRegistration = async () => {
  if (swRegistration) return swRegistration;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error("SW timeout")), 2000)),
    ]);
    swRegistration = reg;
    return reg;
  } catch {
    return null;
  }
};

const display = async (title, options) => {
  const reg = await ensureRegistration();
  if (reg && typeof reg.showNotification === "function") {
    return reg.showNotification(title, options);
  }
  // Fallback (desktop without SW). On iOS PWA this throws TypeError.
  try {
    new Notification(title, options);
  } catch (e) {
    console.warn("[notif] Notification constructor failed:", e);
    throw e;
  }
};

export const showTestNotification = () =>
  display("Notifications activées 🔔", {
    body: "Tu seras prévenu 15 min avant chaque cours.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "edt-test-notif",
  });

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
      const minutesUntil = Math.max(0, Math.round((startT - Date.now()) / 60000));
      display(`Cours dans ${minutesUntil} min`, {
        body: `${ev.summary || "Cours"}${ev.location ? " — " + ev.location : ""}`,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: `course-${startT}`,
        data: { startT },
      }).catch((e) => console.warn("[notif] display failed:", e));
    }, delay);
    timers.push(id);
  }

  console.debug(`[notif] scheduled ${upcoming.length} notification(s) for the next 24h`);
  return upcoming.length;
};
