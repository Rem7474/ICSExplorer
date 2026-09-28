// localStorage keys used by the app (kept stable across versions: users'
// selections, favorites and cached calendars live under these names).
export const SELECTION_KEY = "edtSelection";
export const BASE_SCHEDULE_KEY = "edtBaseSchedule";
export const PERSONAL_CACHE_KEY = "edt_cached_personal_ics";
export const PERSONAL_META_KEY = "edt_personal_meta";
export const DISABLED_SUBJECTS_KEY = "edtDisabledSubjects";
export const SHOW_RU_MENU_KEY = "edtShowRuMenu";

const hasStorage = () => typeof localStorage !== "undefined";

/** Reads a string, returning null when storage is unavailable. */
export const readString = (key) => {
  try {
    return hasStorage() ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

/** Reads and parses a JSON value, returning `fallback` when missing or invalid. */
export const readJSON = (key, fallback = null) => {
  const raw = readString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

/** Writes a string or JSON-serializable value; storage errors are ignored. */
export const write = (key, value) => {
  try {
    if (hasStorage()) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Quota exceeded or private browsing restrictions
  }
};

export const remove = (...keys) => {
  try {
    if (hasStorage()) keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore restricted storage
  }
};
