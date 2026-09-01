import { ref, computed, watch } from "vue";
import { fetchFileList, fetchIcsText, fetchPersonalCalendar, fileUrl } from "../ics/api.js";
import { parseIcs } from "../ics/parser.js";
import { getRelevantWeekStart, getWeekStart, getWeekEnd } from "../utils/dates.js";
import { getTeacherIndex, getRoomIndex } from "../ics/aggregator.js";

const STORAGE_KEY = "edtSelection";
const PERSONAL_CREDENTIALS_KEY = "edtPersonalCreds";
const PERSONAL_CACHE_KEY = "edt_cached_personal_ics";
const PERSONAL_META_KEY = "edt_personal_meta";

export function useSchedule() {
  const availableFiles = ref([]);
  const availableTeachers = ref([]);
  const availableRooms = ref([]);
  
  const selectedMode = ref("student"); // "student" | "personal" | "teacher" | "room"
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
  const selectedSubjectFilter = ref(null);
  
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
    if (!selectedSubjectFilter.value) return weekEvents.value;
    return weekEvents.value.filter((ev) => {
      const summary = ev.summary || "";
      return summary.startsWith(selectedSubjectFilter.value);
    });
  });

  // Next upcoming course
  const nextCourse = computed(() => {
    const now = new Date();
    return events.value.find((ev) => new Date(ev.end) > now) || null;
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

      if (urlTeacher) {
        selectedMode.value = "teacher";
        selectedTeacher.value = urlTeacher;
        await loadTeacherSchedule(urlTeacher);
      } else if (urlRoom) {
        selectedMode.value = "room";
        selectedRoom.value = urlRoom;
        await loadRoomSchedule(urlRoom);
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
    statusMessage.value = "Chargement de l'emploi du temps...";

    try {
      const text = await fetchIcsText(fileName);
      const parsed = parseIcs(text);
      events.value = parsed;
      currentWeekStart.value = getRelevantWeekStart(parsed);
      statusMessage.value = "";

      // Save selection
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
    let creds = null;
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

  const loadTeacherSchedule = async (teacherName) => {
    if (!teacherName) return;
    isLoading.value = true;
    statusMessage.value = "Agrégation des cours du professeur...";

    try {
      const teacherMap = await getTeacherIndex();
      const teacherEvents = teacherMap.get(teacherName) || [];
      teacherEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      events.value = teacherEvents;
      currentWeekStart.value = getRelevantWeekStart(teacherEvents);
      statusMessage.value = "";

      const url = new URL(window.location);
      url.searchParams.set("teacher", teacherName);
      url.searchParams.delete("file");
      url.searchParams.delete("room");
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
    statusMessage.value = "Recherche des cours dans la salle...";

    try {
      const roomMap = await getRoomIndex();
      const roomEvents = roomMap.get(roomName) || [];
      roomEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      events.value = roomEvents;
      currentWeekStart.value = getRelevantWeekStart(roomEvents);
      statusMessage.value = "";

      const url = new URL(window.location);
      url.searchParams.set("room", roomName);
      url.searchParams.delete("file");
      url.searchParams.delete("teacher");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
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
    selectedSubjectFilter.value = selectedSubjectFilter.value === type ? null : type;
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
        statusMessage.value = "Synchronisation démarrée en arrière-plan. Actualisation dans quelques instants...";
        setTimeout(init, 4000);
      } else {
        const data = await resp.json();
        statusMessage.value = data.message || "Erreur de synchronisation";
      }
    } catch (e) {
      statusMessage.value = "Impossible de contacter l'API";
    }
  };

  return {
    availableFiles,
    availableTeachers,
    availableRooms,
    selectedMode,
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
    openRoomModal,
    closeRoomModal,
    openEventModal,
    closeEventModal,
    triggerSync,
  };
}
