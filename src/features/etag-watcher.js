// Compares the ETag (or Last-Modified) of an ICS file with the one stored from
// the previous fetch. Notifies the caller when the file has changed.
//
// Why ETag? It's an HTTP header set by the server identifying a specific version
// of a resource. We store it client-side and compare on each fetch — no diffing
// the file content needed.

const STORAGE_PREFIX = "etag:";

const storageKey = (url) => `${STORAGE_PREFIX}${url}`;

export const readStoredVersion = (url) => {
  try {
    return localStorage.getItem(storageKey(url));
  } catch {
    return null;
  }
};

export const storeVersion = (url, version) => {
  if (!version) return;
  try {
    localStorage.setItem(storageKey(url), version);
  } catch {
    /* quota / private mode */
  }
};

// Returns { changed: boolean, version: string|null }
// `changed` is true only if a previous version existed AND differs.
export const checkVersion = (url, response) => {
  const version =
    response.headers.get("ETag") ||
    response.headers.get("Last-Modified") ||
    null;
  const previous = readStoredVersion(url);
  const changed = Boolean(previous && version && previous !== version);
  if (version) storeVersion(url, version);
  return { changed, version, previous };
};
