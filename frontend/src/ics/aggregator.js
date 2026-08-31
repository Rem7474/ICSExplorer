import { fetchIcsText, fetchFileList } from "./api.js";
import { parseIcs, extractTeacherNames } from "./parser.js";

let cachedAllEvents = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const getAggregatedEvents = async (progressCallback) => {
  const now = Date.now();
  if (cachedAllEvents && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAllEvents;
  }

  const files = await fetchFileList();
  const studentFiles = files.filter((f) => !f.toLowerCase().includes("prof") && !f.toLowerCase().includes("salle"));

  const allEvents = [];
  let loaded = 0;

  for (const file of studentFiles) {
    try {
      const text = await fetchIcsText(file);
      const events = parseIcs(text);
      events.forEach((e) => (e.sourceFile = file));
      allEvents.push(...events);
    } catch {}

    loaded++;
    if (progressCallback) {
      progressCallback(loaded, studentFiles.length);
    }
  }

  cachedAllEvents = allEvents;
  cacheTimestamp = now;
  return allEvents;
};

export const getTeacherIndex = async (progressCallback) => {
  const events = await getAggregatedEvents(progressCallback);
  const teacherMap = new Map();

  for (const event of events) {
    const teachers = extractTeacherNames(event.description);
    for (const teacher of teachers) {
      if (!teacherMap.has(teacher)) {
        teacherMap.set(teacher, []);
      }
      teacherMap.get(teacher).push(event);
    }
  }

  return teacherMap;
};

export const getRoomIndex = async (progressCallback) => {
  const events = await getAggregatedEvents(progressCallback);
  const roomMap = new Map();

  for (const event of events) {
    if (event.location) {
      const rooms = event.location.split(",").map((r) => r.trim()).filter(Boolean);
      for (const room of rooms) {
        if (!roomMap.has(room)) {
          roomMap.set(room, []);
        }
        roomMap.get(room).push(event);
      }
    }
  }

  return roomMap;
};
