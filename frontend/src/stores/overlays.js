import { defineStore } from "pinia";
import { ref } from "vue";
import { fetchCercleEvents, fetchRuEvents } from "../ics/api.js";
import { readString, write, SHOW_RU_MENU_KEY } from "./storage.js";

/** Adds overlay events not already present (by UID) and keeps chronological order. */
const mergeByUid = (base, extra) => {
  if (!extra || !extra.length) return base;
  const existingUids = new Set(base.map((e) => e.uid).filter(Boolean));
  const combined = [...base, ...extra.filter((e) => !e.uid || !existingUids.has(e.uid))];
  combined.sort((a, b) => new Date(a.start) - new Date(b.start));
  return combined;
};

/** Overlay calendars merged on top of schedules: Cercle events and RU menus. */
export const useOverlaysStore = defineStore("overlays", () => {
  const cercleEvents = ref([]);
  const ruEvents = ref([]);
  const savedShowRu = readString(SHOW_RU_MENU_KEY);
  const showRuMenu = ref(savedShowRu === null ? true : savedShowRu === "true");

  const loadCercleEvents = async () => {
    if (cercleEvents.value.length > 0) return cercleEvents.value;
    try {
      cercleEvents.value = await fetchCercleEvents();
    } catch {
      return [];
    }
    return cercleEvents.value;
  };

  const loadRuEvents = async () => {
    if (ruEvents.value.length > 0) return ruEvents.value;
    try {
      ruEvents.value = await fetchRuEvents();
    } catch {
      return [];
    }
    return ruEvents.value;
  };

  /** Loads the RU menu only when it is shown. */
  const loadRuEventsIfShown = () => (showRuMenu.value ? loadRuEvents() : Promise.resolve([]));

  const mergeWithCercle = (events, cercle) => mergeByUid(events, cercle);
  const mergeWithRu = (events, ru) => (showRuMenu.value ? mergeByUid(events, ru) : events);

  const setShowRuMenu = (value) => {
    showRuMenu.value = value;
    write(SHOW_RU_MENU_KEY, String(value));
  };

  /** Drops cached overlays so the next load fetches fresh data. */
  const invalidate = () => {
    cercleEvents.value = [];
    ruEvents.value = [];
  };

  return {
    cercleEvents,
    ruEvents,
    showRuMenu,
    loadCercleEvents,
    loadRuEvents,
    loadRuEventsIfShown,
    mergeWithCercle,
    mergeWithRu,
    setShowRuMenu,
    invalidate,
  };
});
