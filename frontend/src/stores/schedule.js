import { defineStore, storeToRefs } from "pinia";
import { ref, computed, watch } from "vue";
import { fetchIcsText, fetchFileList, fetchPersonalCalendar, decodeTextWithFallback } from "../ics/api.js";
import { parseIcs } from "../ics/parser.js";
import { getRelevantWeekStart, getWeekStart, getWeekEnd } from "../utils/dates.js";
import { getTeacherIndex, getRoomIndex, clearAggregatedCache } from "../ics/aggregator.js";
import { getSubjectType, getDiscipline, isRuEvent } from "../utils/colors.js";
import { scrubStoredCredentials } from "../utils/credentials.js";
import { useToast } from "../composables/useToast.js";
import { router, SCHEDULE_QUERY_KEYS } from "../router/index.js";
import { readJSON, write, SELECTION_KEY, BASE_SCHEDULE_KEY, DISABLED_SUBJECTS_KEY } from "./storage.js";
import { useCatalogStore } from "./catalog.js";
import { useOverlaysStore } from "./overlays.js";
import { usePersonalStore } from "./personal.js";
import { useServerStore } from "./server.js";
import { useStatusStore } from "./status.js";

const isHidden = (ev, disabled) =>
  disabled.length > 0 && (disabled.includes(getSubjectType(ev)) || disabled.includes(getDiscipline(ev)));

const areEventsEqual = (evs1, evs2) => {
  if (!Array.isArray(evs1) || !Array.isArray(evs2) || evs1.length !== evs2.length) return false;
  return evs1.every((a, i) => {
    const b = evs2[i];
    return (
      a.summary === b.summary &&
      a.location === b.location &&
      a.description === b.description &&
      new Date(a.start).getTime() === new Date(b.start).getTime() &&
      new Date(a.end).getTime() === new Date(b.end).getTime()
    );
  });
};

/**
 * The displayed planning: which schedule is selected (promo, personal,
 * teacher or room), its events, the visible week and subject filters.
 */
export const useScheduleStore = defineStore("schedule", () => {
  const { showToast } = useToast();
  const catalog = useCatalogStore();
  const overlays = useOverlaysStore();
  const personal = usePersonalStore();
  const server = useServerStore();
  const status = useStatusStore();
  const { availableFiles, availableTeachers, availableRooms, parsedFiles } = storeToRefs(catalog);
  const { statusMessage } = storeToRefs(status);

  // ---------------------------------------------------------------- state
  const selectedMode = ref("student"); // "student" | "personal" | "teacher" | "room"
  const baseSchedule = ref(null); // { mode: "student" | "personal", file?: string, name?: string }
  const selectedYear = ref("");
  const selectedTrack = ref("");
  const selectedType = ref("");
  const selectedFile = ref("");
  const selectedTeacher = ref("");
  const selectedRoom = ref("");

  const events = ref([]);
  const currentWeekStart = ref(getWeekStart(new Date()));
  const disabledSubjects = ref([]);
  const isLoading = ref(false);
  const activeModalEvent = ref(null);
  const isRoomModalOpen = ref(false);

  // Loaders switch the mode themselves; remember it so the selectedMode
  // watcher below does not load the same schedule a second time.
  let internalModeChange = null;
  const switchMode = (mode) => {
    if (selectedMode.value === mode) return;
    internalModeChange = mode;
    selectedMode.value = mode;
  };

  // ------------------------------------------------------------- derived
  const selectedSubjectFilter = computed(() => disabledSubjects.value[0] || null);

  const availableYears = computed(() => [...new Set(parsedFiles.value.map((f) => f.year).filter(Boolean))].sort());

  const availableTracks = computed(() => {
    if (!selectedYear.value) return [];
    return [
      ...new Set(parsedFiles.value.filter((f) => f.year === selectedYear.value).map((f) => f.track).filter(Boolean)),
    ].sort();
  });

  const availableTypes = computed(() => {
    if (!selectedYear.value || !selectedTrack.value) return [];
    return [
      ...new Set(
        parsedFiles.value
          .filter((f) => f.year === selectedYear.value && f.track === selectedTrack.value)
          .map((f) => f.type)
          .filter(Boolean)
      ),
    ].sort();
  });

  const availableRestFiles = computed(() => {
    if (!selectedYear.value || !selectedTrack.value || !selectedType.value) return [];
    return parsedFiles.value.filter(
      (f) => f.year === selectedYear.value && f.track === selectedTrack.value && f.type === selectedType.value
    );
  });

  const currentWeekEnd = computed(() => getWeekEnd(currentWeekStart.value));

  const weekEvents = computed(() =>
    events.value.filter((ev) => new Date(ev.start) <= currentWeekEnd.value && new Date(ev.end) >= currentWeekStart.value)
  );

  const displayedWeekEvents = computed(() =>
    disabledSubjects.value.length ? weekEvents.value.filter((ev) => !isHidden(ev, disabledSubjects.value)) : weekEvents.value
  );

  // Next upcoming course (excluding hidden subjects and RU menus); follows the app clock.
  const nextCourse = computed(() => {
    const now = new Date(server.currentTime);
    return (
      events.value.find((ev) => {
        if (ev.isRu || isRuEvent(ev)) return false;
        if (new Date(ev.end) <= now) return false;
        return !isHidden(ev, disabledSubjects.value);
      }) || null
    );
  });

  // ------------------------------------------------------ subject filters
  const getCurrentScheduleKey = () => {
    if (selectedMode.value === "personal") return "personal";
    if (selectedMode.value === "teacher" && selectedTeacher.value) return `teacher_${selectedTeacher.value}`;
    if (selectedMode.value === "room" && selectedRoom.value) return `room_${selectedRoom.value}`;
    if (selectedFile.value) return `student_${selectedFile.value}`;
    return "default";
  };

  const loadSavedDisabledSubjects = (key = getCurrentScheduleKey()) => {
    const data = readJSON(DISABLED_SUBJECTS_KEY, null);
    if (Array.isArray(data)) return [...data];
    if (data && typeof data === "object" && Array.isArray(data[key])) return [...data[key]];
    return [];
  };

  const saveDisabledSubjects = () => {
    const saved = readJSON(DISABLED_SUBJECTS_KEY, {});
    const data = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    const key = getCurrentScheduleKey();
    if (disabledSubjects.value.length > 0) data[key] = [...disabledSubjects.value];
    else delete data[key];
    write(DISABLED_SUBJECTS_KEY, data);
  };

  const toggleSubjectFilter = (type) => {
    if (!type) return;
    const current = [...disabledSubjects.value];
    const index = current.indexOf(type);
    if (index === -1) current.push(type);
    else current.splice(index, 1);
    disabledSubjects.value = current;
    saveDisabledSubjects();
  };

  const resetSubjectFilters = () => {
    disabledSubjects.value = [];
    saveDisabledSubjects();
  };

  // ------------------------------------------------------------- history
  // User-initiated schedule changes push a history entry so the Back button
  // returns to the previous schedule; restoring state (initial load, Back /
  // Forward) only replaces the current entry.
  let restoringHistory = false;

  const updateUrl = async (params) => {
    if (typeof window === "undefined") return;
    const query = { ...router.currentRoute.value.query };
    for (const key of SCHEDULE_QUERY_KEYS) {
      if (params[key]) query[key] = params[key];
      else delete query[key];
    }
    const target = new URL(window.location);
    for (const key of SCHEDULE_QUERY_KEYS) {
      if (params[key]) target.searchParams.set(key, params[key]);
      else target.searchParams.delete(key);
    }
    // Dedupe against the real address bar (not the router's own record, which
    // can lag if something else touched the history), then force the navigation.
    if (target.href === window.location.href) return;
    const location = { path: target.pathname, query, force: true };
    await (restoringHistory ? router.replace(location) : router.push(location));
  };

  const withHistoryRestore = async (fn) => {
    restoringHistory = true;
    try {
      await fn();
    } finally {
      restoringHistory = false;
    }
  };

  const applyUrlState = async () => {
    const params = new URLSearchParams(window.location.search);
    const teacher = params.get("teacher");
    const room = params.get("room");
    const file = params.get("file");
    if (teacher) await loadTeacherSchedule(teacher);
    else if (room) await loadRoomSchedule(room);
    else if (file && availableFiles.value.includes(file)) await loadSchedule(file);
    else if (params.get("mode") === "personal") await setMode("personal");
    else await returnToBaseSchedule();
  };

  // Back / Forward (popstate) navigations reported by the router history.
  let stopHistoryListener = null;
  const startHistoryListener = () => {
    stopHistoryListener?.();
    stopHistoryListener = router.options.history.listen(() => withHistoryRestore(applyUrlState));
  };
  const stopHistoryListening = () => {
    stopHistoryListener?.();
    stopHistoryListener = null;
  };

  // -------------------------------------------------------------- loaders
  const autoSelectFromFile = (fileName) => {
    const item = catalog.findFile(fileName);
    if (item) {
      selectedYear.value = item.year;
      selectedTrack.value = item.track;
      selectedType.value = item.type;
      selectedFile.value = item.fileName;
    }
  };

  const loadSchedule = async (fileName) => {
    if (!fileName) return;
    isLoading.value = true;
    selectedFile.value = fileName;
    switchMode("student");
    disabledSubjects.value = loadSavedDisabledSubjects(`student_${fileName}`);
    statusMessage.value = "Chargement de l'emploi du temps...";
    autoSelectFromFile(fileName);

    try {
      const [text, cEvents, rEvents] = await Promise.all([
        fetchIcsText(fileName),
        overlays.loadCercleEvents(),
        overlays.loadRuEventsIfShown(),
      ]);
      const parsed = parseIcs(text);
      const merged = overlays.mergeWithRu(overlays.mergeWithCercle(parsed, cEvents), rEvents);
      events.value = merged;
      currentWeekStart.value = getRelevantWeekStart(parsed.length ? parsed : merged);
      statusMessage.value = "";

      baseSchedule.value = { mode: "student", file: fileName, name: fileName.replace(/\.ics$/i, "") };
      write(BASE_SCHEDULE_KEY, baseSchedule.value);
      write(SELECTION_KEY, { mode: "student", file: fileName });
      await updateUrl({ file: fileName });
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  // Loads events from raw ICS text obtained out-of-band (personal calendar).
  // Synchronous for the displayed data; the returned promise resolves once
  // the URL has been updated.
  const loadPersonalEvents = (icsText, meta = {}) => {
    try {
      switchMode("personal");
      disabledSubjects.value = loadSavedDisabledSubjects("personal");
      const parsed = parseIcs(icsText);
      const merged = overlays.mergeWithRu(parsed, overlays.ruEvents);
      events.value = merged;
      currentWeekStart.value = getRelevantWeekStart(parsed.length ? parsed : merged);
      statusMessage.value = "";

      const fullMeta = personal.remember(icsText, meta);
      baseSchedule.value = { mode: "personal", name: fullMeta.name || "Mon Planning ADE" };
      write(BASE_SCHEDULE_KEY, baseSchedule.value);
      write(SELECTION_KEY, { mode: "personal" });
      return updateUrl({ mode: "personal" });
    } catch (err) {
      statusMessage.value = `Erreur de traitement du calendrier: ${err.message}`;
      return Promise.resolve();
    }
  };

  /** Shows the cached personal calendar, or fetches it with saved credentials. */
  const showPersonalFromCacheOrRefresh = async ({ awaitRefresh = true } = {}) => {
    const cachedIcs = personal.getCachedIcs();
    if (cachedIcs) {
      loadPersonalEvents(cachedIcs, personal.getCachedMeta() || {});
      return true;
    }
    if (personal.hasSavedCredentials()) {
      const refresh = refreshPersonalSchedule();
      if (awaitRefresh) await refresh;
      else refresh.catch(() => {});
      return true;
    }
    return false;
  };

  const refreshPersonalSchedule = async () => {
    const creds = personal.getSavedCredentials();
    if (!creds) {
      status.setStatus("Aucun identifiant sauvegardé pour actualiser le planning personnel.", "configure-personal");
      return;
    }

    isLoading.value = true;
    statusMessage.value = "Actualisation du planning ADE...";
    try {
      const text = await fetchPersonalCalendar(creds);
      loadPersonalEvents(text, {
        ...creds,
        name: personal.personalScheduleInfo?.name || creds.resourceName,
        universityId: creds.universityId,
        resourceId: creds.resourceId,
        inputMode: creds.inputMode,
        branchPath: creds.branchPath || [],
      });
      statusMessage.value = "";
    } catch (err) {
      status.setStatus(`Impossible d'actualiser le planning : ${err.message}`, "configure-personal");
    } finally {
      isLoading.value = false;
    }
  };

  const clearPersonalSchedule = () => {
    personal.forget();
    switchMode("student");
    if (availableFiles.value.length > 0) {
      autoSelectFromFile(availableFiles.value[0]);
      loadSchedule(availableFiles.value[0]);
    }
  };

  const loadTeacherSchedule = async (teacherName) => {
    if (!teacherName) return;
    isLoading.value = true;
    switchMode("teacher");
    selectedTeacher.value = teacherName;
    disabledSubjects.value = loadSavedDisabledSubjects(`teacher_${teacherName}`);
    statusMessage.value = "Agrégation des cours du professeur...";

    try {
      if (availableTeachers.value.length === 0) catalog.loadTeacherList().catch(() => {});
      const [teacherMap, cEvents, rEvents] = await Promise.all([
        getTeacherIndex(),
        overlays.loadCercleEvents(),
        overlays.loadRuEventsIfShown(),
      ]);
      const teacherEvents = teacherMap.get(teacherName) || [];
      const merged = overlays.mergeWithRu(overlays.mergeWithCercle(teacherEvents, cEvents), rEvents);
      events.value = merged;
      currentWeekStart.value = getRelevantWeekStart(teacherEvents.length ? teacherEvents : merged);
      statusMessage.value = "";

      write(SELECTION_KEY, { mode: "teacher", teacher: teacherName });
      await updateUrl({ teacher: teacherName });
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const loadRoomSchedule = async (roomName) => {
    if (!roomName) return;
    isLoading.value = true;
    switchMode("room");
    selectedRoom.value = roomName;
    disabledSubjects.value = loadSavedDisabledSubjects(`room_${roomName}`);
    statusMessage.value = "Recherche des cours dans la salle...";

    try {
      if (availableRooms.value.length === 0) catalog.loadRoomList().catch(() => {});

      let roomEvents = [];
      // 1. Direct room calendar generated by the backend (/rooms/{room}.ics)
      try {
        const resp = await fetch(`/rooms/${encodeURIComponent(roomName)}.ics`, { cache: "no-store" });
        if (resp.ok) roomEvents = parseIcs(await decodeTextWithFallback(resp));
      } catch {}

      // 2. Fallback to the index aggregated from promo calendars
      if (!roomEvents || roomEvents.length === 0) {
        const roomMap = await getRoomIndex();
        roomEvents = roomMap.get(roomName) || [];
      }

      roomEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      events.value = roomEvents;
      currentWeekStart.value = getRelevantWeekStart(roomEvents);
      statusMessage.value = "";

      switchMode("room");
      selectedRoom.value = roomName;
      write(SELECTION_KEY, { mode: "room", room: roomName });
      await updateUrl({ room: roomName });
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const defaultStudentFile = () =>
    selectedFile.value || baseSchedule.value?.file || (availableFiles.value.length > 0 ? availableFiles.value[0] : "");

  const returnToBaseSchedule = async () => {
    const base = baseSchedule.value || readJSON(BASE_SCHEDULE_KEY, null);

    if (base?.mode === "personal") {
      switchMode("personal");
      await showPersonalFromCacheOrRefresh();
      return;
    }

    switchMode("student");
    const targetFile = base?.file || selectedFile.value || (availableFiles.value.length > 0 ? availableFiles.value[0] : "");
    if (targetFile) {
      autoSelectFromFile(targetFile);
      await loadSchedule(targetFile);
    }
  };

  const setMode = async (mode) => {
    if (selectedMode.value === mode) {
      // Same mode: only reload if nothing is displayed yet.
      if (events.value.length > 0) return;
      if (mode === "student" && selectedFile.value) await loadSchedule(selectedFile.value);
      else if (mode === "personal") {
        const cachedIcs = personal.getCachedIcs();
        if (cachedIcs) loadPersonalEvents(cachedIcs, personal.getCachedMeta() || {});
      } else if (mode === "teacher" && selectedTeacher.value) await loadTeacherSchedule(selectedTeacher.value);
      else if (mode === "room" && selectedRoom.value) await loadRoomSchedule(selectedRoom.value);
      return;
    }

    switchMode(mode);

    if (mode === "student") {
      const targetFile = defaultStudentFile();
      if (targetFile) {
        autoSelectFromFile(targetFile);
        await loadSchedule(targetFile);
      }
    } else if (mode === "personal") {
      await showPersonalFromCacheOrRefresh();
    } else if (mode === "teacher") {
      if (availableTeachers.value.length === 0) await catalog.loadTeacherList();
      if (selectedTeacher.value) await loadTeacherSchedule(selectedTeacher.value);
    } else if (mode === "room") {
      if (availableRooms.value.length === 0) await catalog.loadRoomList();
      if (selectedRoom.value) await loadRoomSchedule(selectedRoom.value);
    }
  };

  // Mode switches made by assigning selectedMode directly (selects, tabs):
  // load lists lazily and restore the matching schedule.
  watch(selectedMode, (newMode, oldMode) => {
    if (newMode === oldMode) return;
    if (internalModeChange === newMode) {
      internalModeChange = null;
      return;
    }
    internalModeChange = null;
    if (newMode === "teacher") {
      if (availableTeachers.value.length === 0) catalog.loadTeacherList();
      if (selectedTeacher.value) loadTeacherSchedule(selectedTeacher.value);
    } else if (newMode === "room") {
      if (availableRooms.value.length === 0) catalog.loadRoomList();
      if (selectedRoom.value) loadRoomSchedule(selectedRoom.value);
    } else if (newMode === "student" && oldMode && oldMode !== "student") {
      const targetFile = defaultStudentFile();
      if (targetFile) {
        autoSelectFromFile(targetFile);
        loadSchedule(targetFile);
      }
    } else if (newMode === "personal" && oldMode && oldMode !== "personal") {
      showPersonalFromCacheOrRefresh({ awaitRefresh: false });
    }
  });

  // Refreshes the displayed schedule in place after a server sync.
  const reloadCurrentScheduleSilently = async () => {
    let changed = false;
    try {
      try {
        const files = await fetchFileList();
        if (Array.isArray(files) && files.length > 0) availableFiles.value = files;
      } catch {}

      clearAggregatedCache();
      overlays.invalidate();

      let newEvents = [];
      if (selectedMode.value === "student" && selectedFile.value) {
        const [text, cEvents, rEvents] = await Promise.all([
          fetchIcsText(selectedFile.value),
          overlays.loadCercleEvents(),
          overlays.loadRuEventsIfShown(),
        ]);
        newEvents = overlays.mergeWithRu(overlays.mergeWithCercle(parseIcs(text), cEvents), rEvents);
      } else if (selectedMode.value === "teacher" && selectedTeacher.value) {
        const teacherMap = await getTeacherIndex();
        const tEvents = teacherMap.get(selectedTeacher.value) || [];
        const [cEvents, rEvents] = await Promise.all([overlays.loadCercleEvents(), overlays.loadRuEventsIfShown()]);
        newEvents = overlays.mergeWithRu(overlays.mergeWithCercle(tEvents, cEvents), rEvents);
      } else if (selectedMode.value === "room" && selectedRoom.value) {
        try {
          newEvents = parseIcs(await fetchIcsText(`${selectedRoom.value}.ics`));
        } catch {
          const roomMap = await getRoomIndex();
          newEvents = roomMap.get(selectedRoom.value) || [];
        }
      } else if (selectedMode.value === "personal") {
        if (personal.hasSavedCredentials()) {
          await refreshPersonalSchedule().catch(() => {});
          return false;
        }
      }

      if (newEvents && newEvents.length > 0 && !areEventsEqual(events.value, newEvents)) {
        events.value = newEvents;
        changed = true;
        showToast("Planning mis à jour", "info", 3000);
      }
    } catch (err) {
      console.warn("Silent schedule reload failed:", err);
    }
    return changed;
  };

  server.onSync(reloadCurrentScheduleSilently);

  const toggleRuMenu = async () => {
    overlays.setShowRuMenu(!overlays.showRuMenu);
    if (overlays.showRuMenu) {
      if (overlays.ruEvents.length === 0) await overlays.loadRuEvents();
      const existing = events.value.filter((e) => !e.isRu && !isRuEvent(e));
      events.value = overlays.mergeWithRu(existing, overlays.ruEvents);
      showToast("Menu du RU affiché", "info");
    } else {
      events.value = events.value.filter((e) => !e.isRu && !isRuEvent(e));
      showToast("Menu du RU masqué", "info");
    }
  };

  // ------------------------------------------------------------------ init
  /** Restores the last schedule (from the URL, then localStorage) on start-up. */
  const init = async () => {
    scrubStoredCredentials();
    restoringHistory = true;
    isLoading.value = true;
    statusMessage.value = "Chargement des calendriers...";

    try {
      await server.checkHealth();
      server.startHealthPolling();
      startHistoryListener();

      const files = await catalog.loadFiles();

      const urlParams = new URLSearchParams(window.location.search);
      const urlMode = urlParams.get("mode");
      const urlFile = urlParams.get("file");
      const urlTeacher = urlParams.get("teacher");
      const urlRoom = urlParams.get("room");

      const saved = readJSON(SELECTION_KEY, {}) || {};
      const savedBase = readJSON(BASE_SCHEDULE_KEY, null);
      if (savedBase) {
        baseSchedule.value = savedBase;
      } else if (saved.mode === "student" && saved.file) {
        baseSchedule.value = { mode: "student", file: saved.file, name: saved.file.replace(/\.ics$/i, "") };
      } else if (saved.mode === "personal") {
        baseSchedule.value = { mode: "personal", name: "Mon Planning ADE" };
      }

      const openFirstFile = async (file) => {
        switchMode("student");
        autoSelectFromFile(file);
        await loadSchedule(file);
      };

      if (urlTeacher) {
        switchMode("teacher");
        selectedTeacher.value = urlTeacher;
        await Promise.all([catalog.loadTeacherList(), loadTeacherSchedule(urlTeacher)]);
      } else if (urlRoom) {
        switchMode("room");
        selectedRoom.value = urlRoom;
        await Promise.all([catalog.loadRoomList(), loadRoomSchedule(urlRoom)]);
      } else if (urlFile && files.includes(urlFile)) {
        await openFirstFile(urlFile);
      } else if (urlMode === "personal" || saved.mode === "personal") {
        const cachedIcs = personal.getCachedIcs();
        if (cachedIcs) {
          loadPersonalEvents(cachedIcs, personal.getCachedMeta() || {});
          // Show the cached copy immediately, refresh in the background.
          if (personal.hasSavedCredentials()) refreshPersonalSchedule().catch(() => {});
        } else if (personal.hasSavedCredentials()) {
          await refreshPersonalSchedule();
        } else if (files.length > 0) {
          await openFirstFile(files[0]);
        }
      } else if (saved.mode === "teacher" && saved.teacher) {
        switchMode("teacher");
        selectedTeacher.value = saved.teacher;
        await Promise.all([catalog.loadTeacherList(), loadTeacherSchedule(saved.teacher)]);
      } else if (saved.mode === "room" && saved.room) {
        switchMode("room");
        selectedRoom.value = saved.room;
        await Promise.all([catalog.loadRoomList(), loadRoomSchedule(saved.room)]);
      } else if (saved.file && files.includes(saved.file)) {
        await openFirstFile(saved.file);
      } else if (files.length > 0) {
        await openFirstFile(files[0]);
      }
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
      restoringHistory = false;
    }
  };

  // --------------------------------------------------------- week & modals
  const shiftWeek = (days) => {
    const d = new Date(currentWeekStart.value);
    d.setDate(d.getDate() + days);
    currentWeekStart.value = d;
  };
  const nextWeek = () => shiftWeek(7);
  const prevWeek = () => shiftWeek(-7);
  const goToCurrentWeek = () => {
    currentWeekStart.value = getWeekStart(new Date());
  };

  const openRoomModal = () => (isRoomModalOpen.value = true);
  const closeRoomModal = () => (isRoomModalOpen.value = false);
  const openEventModal = (ev) => (activeModalEvent.value = ev);
  const closeEventModal = () => (activeModalEvent.value = null);

  return {
    selectedMode,
    baseSchedule,
    selectedYear,
    selectedTrack,
    selectedType,
    selectedFile,
    selectedTeacher,
    selectedRoom,
    events,
    currentWeekStart,
    disabledSubjects,
    isLoading,
    activeModalEvent,
    isRoomModalOpen,
    selectedSubjectFilter,
    availableYears,
    availableTracks,
    availableTypes,
    availableRestFiles,
    currentWeekEnd,
    weekEvents,
    displayedWeekEvents,
    nextCourse,
    init,
    setMode,
    returnToBaseSchedule,
    loadSchedule,
    loadPersonalEvents,
    loadTeacherSchedule,
    loadRoomSchedule,
    refreshPersonalSchedule,
    clearPersonalSchedule,
    reloadCurrentScheduleSilently,
    toggleRuMenu,
    toggleSubjectFilter,
    resetSubjectFilters,
    loadSavedDisabledSubjects,
    saveDisabledSubjects,
    getCurrentScheduleKey,
    startHistoryListener,
    stopHistoryListening,
    nextWeek,
    prevWeek,
    goToCurrentWeek,
    openRoomModal,
    closeRoomModal,
    openEventModal,
    closeEventModal,
  };
});
