/**
 * ADE credentials may only ever be persisted under PERSONAL_CREDENTIALS_KEY,
 * and only when the user ticks "Se souvenir de moi". Every other stored object
 * (schedule metadata, legacy keys) must be free of them.
 */
export const PERSONAL_CREDENTIALS_KEY = "edtPersonalCreds";

const SECRET_FIELDS = ["login", "password"];

// Keys that older versions wrote with the login/password inside, regardless of "remember".
const METADATA_KEYS = ["edt_personal_meta", "personalScheduleMeta"];

/** Returns a shallow copy of obj without credential fields. */
export const stripCredentials = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const copy = { ...obj };
  for (const field of SECRET_FIELDS) delete copy[field];
  return copy;
};

/**
 * Removes credentials that previous versions leaked into schedule metadata.
 * Safe to call on every start-up.
 */
export const scrubStoredCredentials = () => {
  try {
    if (typeof localStorage === "undefined") return;
    for (const key of METADATA_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (parsed && typeof parsed === "object" && SECRET_FIELDS.some((f) => f in parsed)) {
        localStorage.setItem(key, JSON.stringify(stripCredentials(parsed)));
      }
    }
  } catch {
    // Ignore private browsing / restricted storage errors
  }
};
