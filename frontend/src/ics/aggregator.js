import { fetchIcsText, fetchFileList } from "./api.js";
import { parseIcs, extractTeacherNames } from "./parser.js";

let cachedAllEvents = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const clearAggregatedCache = () => {
  cachedAllEvents = null;
  cacheTimestamp = 0;
};

export const getAggregatedEvents = async (progressCallback) => {
  const now = Date.now();
  if (cachedAllEvents && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAllEvents;
  }

  const files = await fetchFileList();
  const studentFiles = files.filter((f) => !f.toLowerCase().includes("prof") && !f.toLowerCase().includes("salle"));

  const allEvents = [];
  let loaded = 0;

  const BATCH_SIZE = 8;
  for (let i = 0; i < studentFiles.length; i += BATCH_SIZE) {
    const batch = studentFiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          const text = await fetchIcsText(file);
          const events = parseIcs(text);
          events.forEach((e) => (e.sourceFile = file));
          return events;
        } catch {
          return [];
        } finally {
          loaded++;
          if (progressCallback) {
            progressCallback(loaded, studentFiles.length);
          }
        }
      })
    );
    for (const evts of results) {
      allEvents.push(...evts);
    }
  }

  cachedAllEvents = allEvents;
  cacheTimestamp = now;
  return allEvents;
};

export const getTeacherIndex = async (progressCallback) => {
  const events = await getAggregatedEvents(progressCallback);
  const teacherMap = new Map();
  const teacherSeenKeys = new Map();

  for (const event of events) {
    const teachers = extractTeacherNames(event.description);
    const sTime = event.start ? new Date(event.start).getTime() : 0;
    const eTime = event.end ? new Date(event.end).getTime() : 0;
    const sum = (event.summary || "").trim().toLowerCase();
    const dedupKey = `${sTime}_${eTime}_${sum}`;

    for (const teacher of teachers) {
      if (!teacherMap.has(teacher)) {
        teacherMap.set(teacher, []);
        teacherSeenKeys.set(teacher, new Map());
      }
      const seenMap = teacherSeenKeys.get(teacher);
      if (seenMap.has(dedupKey)) {
        const existing = seenMap.get(dedupKey);
        if (event.sourceFile && existing.sourceFiles && !existing.sourceFiles.includes(event.sourceFile)) {
          existing.sourceFiles.push(event.sourceFile);
        }
      } else {
        const copy = { ...event };
        copy.sourceFiles = event.sourceFile ? [event.sourceFile] : [];
        seenMap.set(dedupKey, copy);
        teacherMap.get(teacher).push(copy);
      }
    }
  }

  return teacherMap;
};

export const getRoomIndex = async (progressCallback) => {
  const events = await getAggregatedEvents(progressCallback);
  const roomMap = new Map();
  const roomSeenKeys = new Map();

  for (const event of events) {
    if (event.location) {
      const rooms = event.location.split(",").map((r) => r.trim()).filter(Boolean);
      const sTime = event.start ? new Date(event.start).getTime() : 0;
      const eTime = event.end ? new Date(event.end).getTime() : 0;
      const sum = (event.summary || "").trim().toLowerCase();
      const dedupKey = `${sTime}_${eTime}_${sum}`;

      for (const room of rooms) {
        if (!roomMap.has(room)) {
          roomMap.set(room, []);
          roomSeenKeys.set(room, new Map());
        }
        const seenMap = roomSeenKeys.get(room);
        if (seenMap.has(dedupKey)) {
          const existing = seenMap.get(dedupKey);
          if (event.sourceFile && existing.sourceFiles && !existing.sourceFiles.includes(event.sourceFile)) {
            existing.sourceFiles.push(event.sourceFile);
          }
        } else {
          const copy = { ...event };
          copy.sourceFiles = event.sourceFile ? [event.sourceFile] : [];
          seenMap.set(dedupKey, copy);
          roomMap.get(room).push(copy);
        }
      }
    }
  }

  return roomMap;
};
