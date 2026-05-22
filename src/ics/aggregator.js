import { fetchIcsText } from "./api.js";
import { parseIcs } from "./parser.js";

const TTL_MS = 10 * 60 * 1000;
let cache = { sig: null, events: null, ts: 0 };
let inflight = null;

const sigOf = (files) => files.slice().sort().join("|");

export const invalidateAggregateCache = () => {
  cache = { sig: null, events: null, ts: 0 };
  inflight = null;
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
