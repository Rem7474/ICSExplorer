import { ref, computed, watch } from "vue";
import { fetchFileList, fetchRoomList, fetchIcsText, fetchPersonalCalendar, decodeTextWithFallback } from "../ics/api.js";
import { parseIcs } from "../ics/parser.js";
import { getRelevantWeekStart, getWeekStart, getWeekEnd } from "../utils/dates.js";
import { getTeacherIndex, getRoomIndex, clearAggregatedCache } from "../ics/aggregator.js";
import { getSubjectType } from "../utils/colors.js";

const STORAGE_KEY = "edtSelection";
const BASE_SCHEDULE_KEY = "edtBaseSchedule";
const PERSONAL_CREDENTIALS_KEY = "edtPersonalCreds";
const PERSONAL_CACHE_KEY = "edt_cached_personal_ics";
const PERSONAL_META_KEY = "edt_personal_meta";

export function useSchedule() {
  const availableFiles = ref([]);
  const availableTeachers = ref([]);
  const availableRooms = ref([]);
  
  const selectedMode = ref("student"); // "student" | "personal" | "teacher" | "room"
  const baseSchedule = ref(null); // { mode: "student" | "personal", file?: string, name?: string }
  const selectedYear = ref("");
  const selectedTrack = ref("");
  const selectedType = ref("");
  const selectedFile = ref("");
  
  const selectedTeacher = ref("");
  const selectedRoom = ref("");

  const personalScheduleInfo = ref(null);
  const rawPersonalIcs = ref("");
  
  const events = ref([]);
  const currentWeekStart = ref(getWeekStart(new Date()));
  const disabledSubjects = ref([]);
  const selectedSubjectFilter = computed(() => disabledSubjects.value[0] || null);
  
  const isLoading = ref(false);
  const isAggregatorLoading = ref(false);
  const statusMessage = ref("");
  
  const activeModalEvent = ref(null);
  const isRoomModalOpen = ref(false);
  const serverHealth = ref(null);

  // Parse available options for student selects
  const parsedFiles = computed(() => {
    return availableFiles.value.map((fileName) => {
      const base = fileName.replace(/\.ics$/i, "");
      const parts = base.split("-");
      return {
        fileName,
        year: parts[0] || "",
        track: parts[1] || "",
        type: parts[2] || "",
        rest: parts.slice(3).join("-"),
      };
    });
  });

  const availableYears = computed(() => {
    return [...new Set(parsedFiles.value.map((f) => f.year).filter(Boolean))].sort();
  });

  const availableTracks = computed(() => {
    if (!selectedYear.value) return [];
    return [...new Set(parsedFiles.value.filter((f) => f.year === selectedYear.value).map((f) => f.track).filter(Boolean))].sort();
  });

  const availableTypes = computed(() => {
    if (!selectedYear.value || !selectedTrack.value) return [];
    return [...new Set(parsedFiles.value.filter((f) => f.year === selectedYear.value && f.track === selectedTrack.value).map((f) => f.type).filter(Boolean))].sort();
  });

  const availableRestFiles = computed(() => {
    if (!selectedYear.value || !selectedTrack.value || !selectedType.value) return [];
    return parsedFiles.value.filter((f) => f.year === selectedYear.value && f.track === selectedTrack.value && f.type === selectedType.value);
  });

  // Filtered week events
  const currentWeekEnd = computed(() => getWeekEnd(currentWeekStart.value));

  const weekEvents = computed(() => {
    return events.value.filter((ev) => {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      return start <= currentWeekEnd.value && end >= currentWeekStart.value;
    });
  });

  const displayedWeekEvents = computed(() => {
    if (!disabledSubjects.value.length) return weekEvents.value;
    return weekEvents.value.filter((ev) => {
      const type = getSubjectType(ev.summary || "");
      return !disabledSubjects.value.includes(type);
    });
  });

  // Next upcoming course (excluding deselected/hidden subjects)
  const nextCourse = computed(() => {
    const now = new Date();
    return events.value.find((ev) => {
      if (new Date(ev.end) <= now) return false;
      if (disabledSubjects.value.length > 0) {
        const type = getSubjectType(ev.summary || "");
        if (disabledSubjects.value.includes(type)) return false;
      }
      return true;
    }) || null;
  });

  // Actions
  const init = async () => {
    isLoading.value = true;
    statusMessage.value = "Chargement des calendriers...";

    try {
      // Check server health
      fetch("/api/health")
        .then((r) => r.json())
        .then((data) => (serverHealth.value = data))
        .catch(() => {});

      const files = await fetchFileList();
      availableFiles.value = files;

      // Restore selection from URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const urlMode = urlParams.get("mode");
      const urlFile = urlParams.get("file");
      const urlTeacher = urlParams.get("teacher");
      const urlRoom = urlParams.get("room");

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const savedBase = JSON.parse(localStorage.getItem(BASE_SCHEDULE_KEY) || "null");
      if (savedBase) {
        baseSchedule.value = savedBase;
      } else if (saved.mode === "student" && saved.file) {
        baseSchedule.value = { mode: "student", file: saved.file, name: saved.file.replace(/\.ics$/i, "") };
      } else if (saved.mode === "personal") {
        baseSchedule.value = { mode: "personal", name: "Mon Planning ADE" };
      }

      if (urlTeacher) {
        selectedMode.value = "teacher";
        selectedTeacher.value = urlTeacher;
        await Promise.all([loadTeacherList(), loadTeacherSchedule(urlTeacher)]);
      } else if (urlRoom) {
        selectedMode.value = "room";
        selectedRoom.value = urlRoom;
        await Promise.all([loadRoomList(), loadRoomSchedule(urlRoom)]);
      } else if (urlFile && files.includes(urlFile)) {
        selectedMode.value = "student";
        autoSelectFromFile(urlFile);
        await loadSchedule(urlFile);
      } else if (urlMode === "personal" || saved.mode === "personal") {
        const cachedIcs = localStorage.getItem(PERSONAL_CACHE_KEY);
        const meta = JSON.parse(localStorage.getItem(PERSONAL_META_KEY) || "null");

        if (cachedIcs) {
          loadPersonalEvents(cachedIcs, meta || {});
          if (localStorage.getItem(PERSONAL_CREDENTIALS_KEY)) {
            refreshPersonalSchedule().catch(() => {});
          }
        } else if (localStorage.getItem(PERSONAL_CREDENTIALS_KEY)) {
          await refreshPersonalSchedule();
        } else if (files.length > 0) {
          selectedMode.value = "student";
          autoSelectFromFile(files[0]);
          await loadSchedule(files[0]);
        }
      } else if (saved.mode === "teacher" && saved.teacher) {
        selectedMode.value = "teacher";
        selectedTeacher.value = saved.teacher;
        await Promise.all([loadTeacherList(), loadTeacherSchedule(saved.teacher)]);
      } else if (saved.mode === "room" && saved.room) {
        selectedMode.value = "room";
        selectedRoom.value = saved.room;
        await Promise.all([loadRoomList(), loadRoomSchedule(saved.room)]);
      } else {
        if (saved.file && files.includes(saved.file)) {
          selectedMode.value = "student";
          autoSelectFromFile(saved.file);
          await loadSchedule(saved.file);
        } else if (files.length > 0) {
          selectedMode.value = "student";
          autoSelectFromFile(files[0]);
          await loadSchedule(files[0]);
        }
      }
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const autoSelectFromFile = (fileName) => {
    const item = parsedFiles.value.find((f) => f.fileName === fileName);
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
    disabledSubjects.value = [];
    statusMessage.value = "Chargement de l'emploi du temps...";

    try {
      const text = await fetchIcsText(fileName);
      const parsed = parseIcs(text);
      events.value = parsed;
      currentWeekStart.value = getRelevantWeekStart(parsed);
      statusMessage.value = "";

      // Save selection and update base schedule reference
      const cleanName = fileName.replace(/\.ics$/i, "");
      baseSchedule.value = { mode: "student", file: fileName, name: cleanName };
      localStorage.setItem(BASE_SCHEDULE_KEY, JSON.stringify(baseSchedule.value));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "student", file: fileName }));
      const url = new URL(window.location);
      url.searchParams.set("file", fileName);
      url.searchParams.delete("mode");
      url.searchParams.delete("teacher");
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  // Loads events from raw ICS text obtained out-of-band (e.g. personal calendar)
  const loadPersonalEvents = (icsText, meta = {}) => {
    try {
      disabledSubjects.value = [];
      const parsed = parseIcs(icsText);
      events.value = parsed;
      currentWeekStart.value = getRelevantWeekStart(parsed);
      selectedMode.value = "personal";
      rawPersonalIcs.value = icsText;
      statusMessage.value = "";

      const now = new Date();
      const lastUpdated = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const fullMeta = {
        name: meta.name || personalScheduleInfo.value?.name || "Mon Planning ADE",
        universityId: meta.universityId || personalScheduleInfo.value?.universityId || "",
        universityName: meta.universityName || personalScheduleInfo.value?.universityName || "",
        resourceId: meta.resourceId || personalScheduleInfo.value?.resourceId || "",
        inputMode: meta.inputMode || personalScheduleInfo.value?.inputMode || "list",
        adeUrl: meta.adeUrl || personalScheduleInfo.value?.adeUrl || "",
        branchPath: meta.branchPath || personalScheduleInfo.value?.branchPath || [],
        login: meta.login || personalScheduleInfo.value?.login || "",
        password: meta.password || personalScheduleInfo.value?.password || "",
        lastUpdated,
      };

      personalScheduleInfo.value = fullMeta;

      baseSchedule.value = {
        mode: "personal",
        name: fullMeta.name || "Mon Planning ADE",
      };
      localStorage.setItem(BASE_SCHEDULE_KEY, JSON.stringify(baseSchedule.value));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "personal" }));
      localStorage.setItem(PERSONAL_CACHE_KEY, icsText);
      localStorage.setItem(PERSONAL_META_KEY, JSON.stringify(fullMeta));

      const url = new URL(window.location);
      url.searchParams.set("mode", "personal");
      url.searchParams.delete("file");
      url.searchParams.delete("teacher");
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur de traitement du calendrier: ${err.message}`;
    }
  };

  const refreshPersonalSchedule = async () => {
    let creds;
    try {
      creds = JSON.parse(localStorage.getItem(PERSONAL_CREDENTIALS_KEY) || "null");
    } catch {
      creds = null;
    }

    if (!creds) {
      statusMessage.value = "Aucun identifiant sauvegardé pour actualiser le planning personnel.";
      return;
    }

    isLoading.value = true;
    statusMessage.value = "Actualisation du planning ADE...";

    try {
      const text = await fetchPersonalCalendar(creds);
      loadPersonalEvents(text, {
        ...creds,
        name: personalScheduleInfo.value?.name || creds.resourceName,
        universityId: creds.universityId,
        resourceId: creds.resourceId,
        inputMode: creds.inputMode,
        branchPath: creds.branchPath || [],
      });
      statusMessage.value = "";
    } catch (err) {
      statusMessage.value = `Impossible d'actualiser le planning : ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const clearPersonalSchedule = () => {
    localStorage.removeItem(PERSONAL_CREDENTIALS_KEY);
    localStorage.removeItem(PERSONAL_CACHE_KEY);
    localStorage.removeItem(PERSONAL_META_KEY);
    localStorage.removeItem("personalAdeCredentials");
    localStorage.removeItem("cachedPersonalIcs");
    localStorage.removeItem("personalScheduleMeta");
    personalScheduleInfo.value = null;
    rawPersonalIcs.value = "";

    selectedMode.value = "student";
    if (availableFiles.value.length > 0) {
      autoSelectFromFile(availableFiles.value[0]);
      loadSchedule(availableFiles.value[0]);
    }
  };

  const downloadPersonalIcs = () => {
    const text = rawPersonalIcs.value || localStorage.getItem(PERSONAL_CACHE_KEY);
    if (!text) return;

    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const baseName = (personalScheduleInfo.value?.name || "mon_planning_ade")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${baseName}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const loadTeacherList = async () => {
    if (availableTeachers.value.length > 0) return;
    isAggregatorLoading.value = true;
    try {
      const teacherMap = await getTeacherIndex();
      availableTeachers.value = Array.from(teacherMap.keys()).sort((a, b) =>
        a.localeCompare(b, "fr", { sensitivity: "base" })
      );
    } catch {
      // Graceful degradation when offline or unindexed
    } finally {
      isAggregatorLoading.value = false;
    }
  };

  const loadRoomList = async () => {
    if (availableRooms.value.length > 0) return;
    isAggregatorLoading.value = true;
    try {
      const roomSet = new Set();

      // Fast path: static room files from /api/rooms
      try {
        const apiRooms = await fetchRoomList();
        apiRooms.forEach((r) => roomSet.add(r));
        if (roomSet.size > 0) {
          availableRooms.value = Array.from(roomSet).sort((a, b) =>
            a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
          );
        }
      } catch {}

      // Aggregated rooms from all parsed student calendars
      try {
        const roomMap = await getRoomIndex();
        for (const room of roomMap.keys()) {
          roomSet.add(room);
        }
      } catch {}

      availableRooms.value = Array.from(roomSet).sort((a, b) =>
        a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
      );
    } catch {
      // Graceful degradation when offline or unindexed
    } finally {
      isAggregatorLoading.value = false;
    }
  };

  // Watch mode switches to load lists lazily when entering teacher/room mode,
  // and automatically restore schedule when returning to student/personal mode
  watch(selectedMode, (newMode, oldMode) => {
    if (newMode === oldMode) return;
    if (newMode === "teacher") {
      if (availableTeachers.value.length === 0) {
        loadTeacherList();
      }
      if (selectedTeacher.value) {
        loadTeacherSchedule(selectedTeacher.value);
      }
    } else if (newMode === "room") {
      if (availableRooms.value.length === 0) {
        loadRoomList();
      }
      if (selectedRoom.value) {
        loadRoomSchedule(selectedRoom.value);
      }
    } else if (newMode === "student" && oldMode && oldMode !== "student") {
      const targetFile = selectedFile.value || baseSchedule.value?.file || (availableFiles.value.length > 0 ? availableFiles.value[0] : "");
      if (targetFile) {
        autoSelectFromFile(targetFile);
        loadSchedule(targetFile);
      }
    } else if (newMode === "personal" && oldMode && oldMode !== "personal") {
      const cachedIcs = localStorage.getItem(PERSONAL_CACHE_KEY);
      const meta = JSON.parse(localStorage.getItem(PERSONAL_META_KEY) || "null");
      if (cachedIcs) {
        loadPersonalEvents(cachedIcs, meta || {});
      } else if (localStorage.getItem(PERSONAL_CREDENTIALS_KEY)) {
        refreshPersonalSchedule().catch(() => {});
      }
    }
  });

  const loadTeacherSchedule = async (teacherName) => {
    if (!teacherName) return;
    isLoading.value = true;
    disabledSubjects.value = [];
    statusMessage.value = "Agrégation des cours du professeur...";

    try {
      if (availableTeachers.value.length === 0) {
        loadTeacherList().catch(() => {});
      }
      const teacherMap = await getTeacherIndex();
      const teacherEvents = teacherMap.get(teacherName) || [];
      teacherEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      events.value = teacherEvents;
      currentWeekStart.value = getRelevantWeekStart(teacherEvents);
      statusMessage.value = "";

      selectedMode.value = "teacher";
      selectedTeacher.value = teacherName;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "teacher", teacher: teacherName }));

      const url = new URL(window.location);
      url.searchParams.set("teacher", teacherName);
      url.searchParams.delete("file");
      url.searchParams.delete("room");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const loadRoomSchedule = async (roomName) => {
    if (!roomName) return;
    isLoading.value = true;
    disabledSubjects.value = [];
    statusMessage.value = "Recherche des cours dans la salle...";

    try {
      if (availableRooms.value.length === 0) {
        loadRoomList().catch(() => {});
      }

      let roomEvents = [];
      // 1. Try fetching direct room calendar from backend /rooms/{roomName}.ics
      try {
        const resp = await fetch(`/rooms/${encodeURIComponent(roomName)}.ics`, { cache: "no-store" });
        if (resp.ok) {
          const text = await decodeTextWithFallback(resp);
          roomEvents = parseIcs(text);
        }
      } catch {}

      // 2. Fallback to aggregator (from student promo files)
      if (!roomEvents || roomEvents.length === 0) {
        const roomMap = await getRoomIndex();
        roomEvents = roomMap.get(roomName) || [];
      }

      roomEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      events.value = roomEvents;
      currentWeekStart.value = getRelevantWeekStart(roomEvents);
      statusMessage.value = "";

      selectedMode.value = "room";
      selectedRoom.value = roomName;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "room", room: roomName }));

      const url = new URL(window.location);
      url.searchParams.set("room", roomName);
      url.searchParams.delete("file");
      url.searchParams.delete("teacher");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  const returnToBaseSchedule = async () => {
    const base = baseSchedule.value || JSON.parse(localStorage.getItem(BASE_SCHEDULE_KEY) || "null");

    if (base?.mode === "personal") {
      selectedMode.value = "personal";
      const cachedIcs = localStorage.getItem(PERSONAL_CACHE_KEY);
      const meta = JSON.parse(localStorage.getItem(PERSONAL_META_KEY) || "null");
      if (cachedIcs) {
        loadPersonalEvents(cachedIcs, meta || {});
      } else if (localStorage.getItem(PERSONAL_CREDENTIALS_KEY)) {
        await refreshPersonalSchedule();
      }
      return;
    }

    selectedMode.value = "student";
    const targetFile = base?.file || selectedFile.value || (availableFiles.value.length > 0 ? availableFiles.value[0] : "");
    if (targetFile) {
      autoSelectFromFile(targetFile);
      await loadSchedule(targetFile);
    }
  };

  const setMode = async (mode) => {
    if (selectedMode.value === mode) {
      if (mode === "student" && selectedFile.value && events.value.length === 0) {
        await loadSchedule(selectedFile.value);
      } else if (mode === "personal" && events.value.length === 0) {
        const cachedIcs = localStorage.getItem(PERSONAL_CACHE_KEY);
        const meta = JSON.parse(localStorage.getItem(PERSONAL_META_KEY) || "null");
        if (cachedIcs) loadPersonalEvents(cachedIcs, meta || {});
      } else if (mode === "teacher" && selectedTeacher.value && events.value.length === 0) {
        await loadTeacherSchedule(selectedTeacher.value);
      } else if (mode === "room" && selectedRoom.value && events.value.length === 0) {
        await loadRoomSchedule(selectedRoom.value);
      }
      return;
    }

    selectedMode.value = mode;

    if (mode === "student") {
      const targetFile = selectedFile.value || baseSchedule.value?.file || (availableFiles.value.length > 0 ? availableFiles.value[0] : "");
      if (targetFile) {
        autoSelectFromFile(targetFile);
        await loadSchedule(targetFile);
      }
    } else if (mode === "personal") {
      const cachedIcs = localStorage.getItem(PERSONAL_CACHE_KEY);
      const meta = JSON.parse(localStorage.getItem(PERSONAL_META_KEY) || "null");
      if (cachedIcs) {
        loadPersonalEvents(cachedIcs, meta || {});
      } else if (localStorage.getItem(PERSONAL_CREDENTIALS_KEY)) {
        await refreshPersonalSchedule();
      }
    } else if (mode === "teacher") {
      if (availableTeachers.value.length === 0) {
        await loadTeacherList();
      }
      if (selectedTeacher.value) {
        await loadTeacherSchedule(selectedTeacher.value);
      }
    } else if (mode === "room") {
      if (availableRooms.value.length === 0) {
        await loadRoomList();
      }
      if (selectedRoom.value) {
        await loadRoomSchedule(selectedRoom.value);
      }
    }
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart.value);
    next.setDate(next.getDate() + 7);
    currentWeekStart.value = next;
  };

  const prevWeek = () => {
    const prev = new Date(currentWeekStart.value);
    prev.setDate(prev.getDate() - 7);
    currentWeekStart.value = prev;
  };

  const goToCurrentWeek = () => {
    currentWeekStart.value = getWeekStart(new Date());
  };

  const toggleSubjectFilter = (type) => {
    if (!type) return;
    const index = disabledSubjects.value.indexOf(type);
    if (index === -1) {
      disabledSubjects.value.push(type);
    } else {
      disabledSubjects.value.splice(index, 1);
    }
  };

  const resetSubjectFilters = () => {
    disabledSubjects.value = [];
  };

  const openRoomModal = () => {
    isRoomModalOpen.value = true;
  };

  const closeRoomModal = () => {
    isRoomModalOpen.value = false;
  };

  const openEventModal = (ev) => {
    activeModalEvent.value = ev;
  };

  const closeEventModal = () => {
    activeModalEvent.value = null;
  };

  const triggerSync = async () => {
    try {
      statusMessage.value = "Déclenchement de la synchronisation...";
      const resp = await fetch("/api/sync", { method: "POST" });
      if (resp.ok) {
        clearAggregatedCache();
        statusMessage.value = "Synchronisation démarrée en arrière-plan. Actualisation dans quelques instants...";
        setTimeout(init, 4000);
      } else {
        const data = await resp.json();
        statusMessage.value = data.message || "Erreur de synchronisation";
      }
    } catch {
      statusMessage.value = "Impossible de contacter l'API";
    }
  };

  return {
    availableFiles,
    availableTeachers,
    availableRooms,
    selectedMode,
    baseSchedule,
    returnToBaseSchedule,
    setMode,
    selectedYear,
    selectedTrack,
    selectedType,
    selectedFile,
    selectedTeacher,
    selectedRoom,
    availableYears,
    availableTracks,
    availableTypes,
    availableRestFiles,
    events,
    currentWeekStart,
    currentWeekEnd,
    weekEvents,
    displayedWeekEvents,
    nextCourse,
    disabledSubjects,
    selectedSubjectFilter,
    isLoading,
    isAggregatorLoading,
    statusMessage,
    activeModalEvent,
    isRoomModalOpen,
    serverHealth,
    init,
    loadSchedule,
    loadPersonalEvents,
    loadTeacherList,
    loadRoomList,
    loadTeacherSchedule,
    loadRoomSchedule,
    personalScheduleInfo,
    refreshPersonalSchedule,
    clearPersonalSchedule,
    downloadPersonalIcs,
    nextWeek,
    prevWeek,
    goToCurrentWeek,
    toggleSubjectFilter,
    resetSubjectFilters,
    openRoomModal,
    closeRoomModal,
    openEventModal,
    closeEventModal,
    triggerSync,
  };
}
