import { fetchIcsText } from "./api.js";
import { parseIcs, extractTeacherNames } from "./parser.js";

const TTL_MS = 10 * 60 * 1000;
let cache = { sig: null, events: null, ts: 0 };
let inflight = null;
let teacherCache = { sig: null, map: null };

const sigOf = (files) => files.slice().sort().join("|");

export const invalidateAggregateCache = () => {
  cache = { sig: null, events: null, ts: 0 };
  inflight = null;
  teacherCache = { sig: null, map: null };
};

export const getAggregatedEvents = async (fileNames) => {
  if (!fileNames || !fileNames.length) return [];
  const sig = sigOf(fileNames);
  const now = Date.now();

  if (cache.sig === sig && cache.events && now - cache.ts < TTL_MS) {
    return cache.events;
  }
  if (inflight && inflight.sig === sig) {
    return inflight.promise;
  }

  const promise = (async () => {
    const arrays = await Promise.all(
      fileNames.map(async (file) => {
        try {
          return parseIcs(await fetchIcsText(file));
        } catch {
          return [];
        }
      })
    );
    const events = arrays.flat();
    cache = { sig, events, ts: Date.now() };
    inflight = null;
    return events;
  })();

  inflight = { sig, promise };
  return promise;
};

// Derived view: Map<teacherName, sortedEvents[]>, computed from aggregated events.
// Memoized on the file list signature so re-asks are free.
export const getTeacherIndex = async (fileNames) => {
  const sig = sigOf(fileNames || []);
  if (teacherCache.sig === sig && teacherCache.map) return teacherCache.map;

  const events = await getAggregatedEvents(fileNames);
  const map = new Map();
  for (const ev of events) {
    const names = extractTeacherNames(ev.description);
    if (!names.length) continue;
    for (const name of names) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(ev);
    }
  }
  map.forEach((list) =>
    list.sort((a, b) => new Date(a.start) - new Date(b.start))
  );

  teacherCache = { sig, map };
  return map;
};
