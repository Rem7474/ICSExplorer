import { ref, computed, watch } from "vue";
import { fetchFileList, fetchIcsText, fileUrl } from "../ics/api.js";
import { parseIcs } from "../ics/parser.js";
import { getRelevantWeekStart, getWeekStart, getWeekEnd } from "../utils/dates.js";
import { getTeacherIndex, getRoomIndex } from "../ics/aggregator.js";

const STORAGE_KEY = "edtSelection";

export function useSchedule() {
  const availableFiles = ref([]);
  const availableTeachers = ref([]);
  const availableRooms = ref([]);
  
  const selectedMode = ref("student"); // "student" | "teacher" | "room"
  const selectedYear = ref("");
  const selectedTrack = ref("");
  const selectedType = ref("");
  const selectedFile = ref("");
  
  const selectedTeacher = ref("");
  const selectedRoom = ref("");
  
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
      const urlFile = urlParams.get("file");
      const urlTeacher = urlParams.get("teacher");
      const urlRoom = urlParams.get("room");

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
      } else {
        // LocalStorage fallback
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (saved.file && files.includes(saved.file)) {
          selectedMode.value = "student";
          autoSelectFromFile(saved.file);
          await loadSchedule(saved.file);
        } else if (files.length > 0) {
          // Default first file
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
      url.searchParams.delete("teacher");
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    } finally {
      isLoading.value = false;
    }
  };

  // Loads events from raw ICS text obtained out-of-band (e.g. the personal
  // calendar endpoint), rather than fetching a known file by name.
  const loadPersonalEvents = (icsText, meta = {}) => {
    try {
      const parsed = parseIcs(icsText);
      events.value = parsed;
      currentWeekStart.value = getRelevantWeekStart(parsed);
      selectedMode.value = "personal";
      statusMessage.value = "";

      const url = new URL(window.location);
      url.searchParams.delete("file");
      url.searchParams.delete("teacher");
      url.searchParams.delete("room");
      if (meta.universityId) {
        url.searchParams.set("university", meta.universityId);
      }
      window.history.replaceState({}, "", url);
    } catch (err) {
      statusMessage.value = `Erreur: ${err.message}`;
    }
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
