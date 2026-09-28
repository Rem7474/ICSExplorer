import { ref, computed } from "vue";
import { getAggregatedEvents } from "../ics/aggregator.js";
import { decodeTextWithFallback, fetchRoomList } from "../ics/api.js";
import { parseIcs } from "../ics/parser.js";
import { formatTimeOnly } from "../utils/dates.js";
import { buildingOf } from "../utils/search.js";

// Rooms always checked, even when the server has no calendar file for them.
export const KNOWN_ROOMS = [
  "A042", "A046", "A048", "A049", "A166",
  "B040", "B042", "B044", "B141", "B148", "B152",
  "C065", "C080", "D001", "D002", "D003", "D004",
];

const pad = (n) => String(n).padStart(2, "0");
/** Local "YYYY-MM-DD" (toISOString() would give the UTC date around midnight). */
export const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "HH:MM" rounded down to the quarter hour. */
export const toTimeInput = (d) => `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 15) * 15)}`;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Availability of each room at `target`, from its events: busy rooms are
 * dropped; free ones say until when (same day) they stay free.
 */
export const computeFreeRooms = (eventsByRoom, target) => {
  const result = [];
  for (const [room, events] of eventsByRoom) {
    const busy = events.some((ev) => new Date(ev.start) <= target && new Date(ev.end) > target);
    if (busy) continue;
    const next = events
      .map((ev) => new Date(ev.start))
      .filter((start) => start > target && sameDay(start, target))
      .sort((a, b) => a - b)[0];
    result.push({
      room,
      building: buildingOf(room),
      until: next || null,
      availabilityText: next ? `Libre jusqu'à ${formatTimeOnly(next)}` : "Libre le reste de la journée",
      isLimited: Boolean(next),
    });
  }
  return result.sort((a, b) => a.room.localeCompare(b.room, "fr", { numeric: true, sensitivity: "base" }));
};

const fetchRoomEvents = async (room) => {
  try {
    const resp = await fetch(`/rooms/${encodeURIComponent(room)}.ics`, { cache: "no-store" });
    if (resp?.ok) return parseIcs(await decodeTextWithFallback(resp));
  } catch {}
  return null;
};

/** Free-room finder state for the "Salles libres" screen. */
export function useFreeRooms() {
  const now = new Date();
  const date = ref(toDateInput(now));
  const time = ref(toTimeInput(now));
  const isLoading = ref(false);
  const rooms = ref([]);
  const searched = ref(false);
  const error = ref("");

  const target = computed(() => {
    const [y, m, d] = date.value.split("-").map(Number);
    const [h, min] = time.value.split(":").map(Number);
    return new Date(y, m - 1, d, h || 0, min || 0);
  });

  let run = 0;
  const search = async () => {
    if (!date.value || !time.value) return;
    const current = ++run;
    isLoading.value = true;
    error.value = "";
    try {
      const names = new Set(KNOWN_ROOMS);
      (await fetchRoomList().catch(() => [])).forEach((r) => names.add(r));

      // Each room's own calendar (/rooms/{room}.ics), in parallel.
      const byRoom = new Map();
      const direct = await Promise.all([...names].map(async (room) => [room, await fetchRoomEvents(room)]));
      const missing = direct.filter(([, events]) => !events).map(([room]) => room);
      direct.forEach(([room, events]) => events && byRoom.set(room, events));

      // Rooms without a calendar file: look them up in the promo calendars.
      if (missing.length) {
        const all = await getAggregatedEvents().catch(() => []);
        for (const room of missing) {
          byRoom.set(room, all.filter((ev) => ev.location?.split(/[,;/]/).some((l) => l.trim() === room)));
        }
      }
      if (current === run) rooms.value = computeFreeRooms(byRoom, target.value);
    } catch {
      if (current === run) error.value = "Impossible de calculer les salles libres. Vérifiez votre connexion.";
    } finally {
      if (current === run) {
        isLoading.value = false;
        searched.value = true;
      }
    }
  };

  /** Sets the searched moment and refreshes the list. */
  const setMoment = (d) => {
    date.value = toDateInput(d);
    time.value = toTimeInput(d);
    return search();
  };

  return { date, time, target, isLoading, rooms, searched, error, search, setMoment };
}
