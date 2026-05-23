import {
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  getWeekStart,
  getWeekEnd,
} from "./utils/dates.js";
import { $, escapeHtml, setSelectOptions } from "./utils/dom.js";
import { getUnique } from "./utils/collections.js";
import {
  createFileCascade,
  getStudentFiles as getStudentFilesFromItems,
} from "./ui/controls.js";
import {
  getSubjectType,
  getSubjectColors,
  invalidateColorCache,
} from "./utils/colors.js";
import {
  parseIcs,
  extractTeacherNames,
  generateIcsEvent,
} from "./ics/parser.js";
import {
  fileUrl,
  fetchIcsText,
  fetchFileListHtml,
  extractIcsLinks,
} from "./ics/api.js";
import {
  getAggregatedEvents,
  invalidateAggregateCache,
} from "./ics/aggregator.js";
import { renderSchedule } from "./ui/schedule.js";
import { initModal, openModal, closeModal } from "./ui/modal.js";
import { showToast } from "./ui/toast.js";
import { initEmptyRoomsFeature } from "./features/empty-rooms.js";
import { renderWeekStats } from "./features/week-stats.js";
import {
  saveSelection,
  writeUrlParams,
  mergeSelectionSources,
} from "./state/persistence.js";

// ===== DOM refs =====
const yearSelect = $("yearSelect");
const trackSelect = $("trackSelect");
const typeSelect = $("typeSelect");
const fileSelect = $("fileSelect");
const teacherSelect = $("teacherSelect");
const modeSelect = $("modeSelect");
const studentControls = $("studentControls");
const teacherControls = $("teacherControls");
const roomControls = $("roomControls");
const refreshBtn = $("refreshBtn");
const statusEl = $("status");
const scheduleEl = $("schedule");
const downloadLink = $("downloadLink");
const subscribeLink = $("subscribeLink");
const shareBtn = $("shareBtn");
const weekStatsEl = $("weekStats");
const dayDotsEl = $("dayDots");
const prevWeekBtn = $("prevWeek");
const nextWeekBtn = $("nextWeek");
const weekLabelEl = $("weekLabel");

const roomSelect = $("roomSelect");
const emptyRoomsBtn = $("emptyRoomsBtn");
const emptyRoomsTime = $("emptyRoomsTime");
const roomModeStatus = $("roomModeStatus");
const emptyRoomsStatus = $("emptyRoomsStatus");

const eventModal = $("eventModal");
const eventTitle = $("eventTitle");
const eventDetails = $("eventDetails");
const closeModalBtn = $("closeModal");
const addToCalendarBtn = $("addToCalendarBtn");

const themeToggle = $("themeToggle");

// ===== State =====
const state = {
  viewEvents: [],
  currentWeekStart: null,
  currentEvent: null,
  teacherEventsByName: new Map(),
  isTeacherListLoading: false,
  currentRoomName: null,
  isRoomSelectPopulated: false,
};

// ===== Cascading selects =====
const fileCascade = createFileCascade({
  yearSelect,
  trackSelect,
  typeSelect,
  fileSelect,
  onComplete: (match) => {
    if (modeSelect.value === "student") teacherSelect.value = "";
    persistCurrentSelection();
    loadSchedule(match.file);
  },
});

// ===== Helpers =====
const setStatus = (message) => {
  statusEl.textContent = message;
};

const setWeekLabel = (weekStart) => {
  const weekEnd = getWeekEnd(weekStart);
  weekLabelEl.textContent = `${formatDateOnly(weekStart)} - ${formatDateOnly(weekEnd)}`;
};

const getStudentFiles = () =>
  getStudentFilesFromItems(fileCascade.getAvailableFiles());

// ===== Render =====
const renderWeek = () => {
  if (!state.currentWeekStart) return;
  setWeekLabel(state.currentWeekStart);
  const weekEnd = getWeekEnd(state.currentWeekStart);
  const weekEvents = state.viewEvents.filter((event) => {
    const start = new Date(event.start);
    return start >= state.currentWeekStart && start <= weekEnd;
  });
  renderSchedule({
    container: scheduleEl,
    events: weekEvents,
    onEventClick: showEventModal,
    dotsContainer: dayDotsEl,
  });
  renderWeekStats(weekStatsEl, weekEvents);
  updateNextCourse();
};

const toWebcalUrl = (httpsUrl) =>
  httpsUrl.replace(/^https?:/, "webcal:");

// ===== Student / file loading =====
const loadSchedule = async (fileName) => {
  if (!fileName) return;
  try {
    setStatus("Chargement de l'emploi du temps…");
    const url = fileUrl(fileName);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Impossible de récupérer le fichier.");
    const text = await response.text();
    state.viewEvents = parseIcs(text);
    state.currentRoomName = null;
    state.currentWeekStart = getWeekStart(new Date());
    renderWeek();
    downloadLink.href = url;
    downloadLink.textContent = `Télécharger (${fileName})`;
    subscribeLink.href = toWebcalUrl(url);
    setStatus(`Chargé : ${fileName}`);
  } catch (error) {
    setStatus("Erreur lors du chargement du fichier ICS.");
    scheduleEl.innerHTML = "<p>Impossible d'afficher cet emploi du temps.</p>";
  }
};

// ===== Teacher mode =====
const buildTeacherIndexFromFiles = async (fileNames) => {
  const teacherMap = new Map();

  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        const text = await fetchIcsText(fileName);
        const events = parseIcs(text);
        events.forEach((event) => {
          const teacherNames = extractTeacherNames(event.description);
          if (!teacherNames.length) return;
          teacherNames.forEach((teacherName) => {
            if (!teacherMap.has(teacherName)) teacherMap.set(teacherName, []);
            teacherMap.get(teacherName).push(event);
          });
        });
      } catch (error) {
        console.warn("Erreur lors du chargement du fichier ICS:", fileName, error);
      }
    })
  );

  teacherMap.forEach((events) => {
    events.sort((a, b) => new Date(a.start) - new Date(b.start));
  });

  return teacherMap;
};

const populateTeacherSelect = (teacherNames) => {
  setSelectOptions(
    teacherSelect,
    "Professeur…",
    teacherNames,
    teacherNames.length === 0
  );
};

const loadTeacherList = async () => {
  if (state.isTeacherListLoading) return { count: 0, error: false };
  state.isTeacherListLoading = true;
  try {
    const studentFiles = getStudentFiles();
    if (!studentFiles.length) {
      populateTeacherSelect([]);
      return { count: 0, error: false };
    }
    state.teacherEventsByName = await buildTeacherIndexFromFiles(studentFiles);
    const teacherNames = getUnique(Array.from(state.teacherEventsByName.keys()));
    populateTeacherSelect(teacherNames);
    return { count: teacherNames.length, error: false };
  } catch (error) {
    populateTeacherSelect([]);
    return { count: 0, error: true };
  } finally {
    state.isTeacherListLoading = false;
  }
};

const loadTeacherSchedule = (teacherName) => {
  if (!teacherName) {
    setStatus("");
    return;
  }
  const events = state.teacherEventsByName.get(teacherName) || [];
  state.viewEvents = events;
  state.currentRoomName = null;
  state.currentWeekStart = getWeekStart(new Date());
  renderWeek();
  downloadLink.href = "#";
  downloadLink.textContent = "Télécharger";
  subscribeLink.href = "#";
  setStatus(`Professeur : ${teacherName}`);
};

// ===== Room mode (uses aggregator — no longer dependent on currently loaded EDT) =====
const populateRoomSelectFromAggregator = async () => {
  if (state.isRoomSelectPopulated) return;
  const files = getStudentFiles();
  if (!files.length) {
    setSelectOptions(roomSelect, "Aucune salle disponible", [], true);
    return;
  }
  setSelectOptions(roomSelect, "Chargement des salles…", [], true);
  roomModeStatus.textContent = "Chargement de la liste des salles…";
  try {
    const events = await getAggregatedEvents(files);
    const rooms = getUnique(
      events
        .map((ev) => (ev.location ? ev.location.trim() : ""))
        .filter(Boolean)
    );
    setSelectOptions(roomSelect, "Salle…", rooms, rooms.length === 0);
    state.isRoomSelectPopulated = true;
    roomModeStatus.textContent = `${rooms.length} salle(s) disponibles.`;
  } catch (error) {
    setSelectOptions(roomSelect, "Erreur de chargement", [], true);
    roomModeStatus.textContent = "Impossible de charger la liste des salles.";
  }
};

const loadRoomSchedule = async (roomName) => {
  if (!roomName) {
    roomModeStatus.textContent = "";
    setStatus("");
    return;
  }
  setStatus(`Chargement de la salle : ${roomName}…`);
  try {
    const files = getStudentFiles();
    const allEvents = await getAggregatedEvents(files);
    const events = allEvents
      .filter(
        (event) =>
          event.location &&
          event.location.trim().toLowerCase() === roomName.toLowerCase()
      )
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    state.viewEvents = events;
    state.currentRoomName = roomName;
    state.currentWeekStart = getWeekStart(new Date());

    if (events.length === 0) {
      scheduleEl.innerHTML = `<p>Aucun événement trouvé pour la salle "${escapeHtml(roomName)}".</p>`;
    } else {
      renderWeek();
    }
    setStatus(`Salle : ${roomName} (${events.length} créneau(x))`);
  } catch (error) {
    setStatus("Erreur lors du chargement de la salle.");
  }
};

// ===== Mode visibility & transitions =====
const updateModeVisibility = () => {
  const mode = modeSelect.value;
  const isTeacher = mode === "teacher";
  const isRoom = mode === "room";

  studentControls.classList.toggle("is-hidden", isTeacher || isRoom);
  teacherControls.classList.toggle("is-hidden", !isTeacher);
  roomControls.classList.toggle("is-hidden", !isRoom);

  shareBtn.style.display = isTeacher || isRoom ? "none" : "inline-block";
  downloadLink.style.display = isTeacher || isRoom ? "none" : "inline-block";
  subscribeLink.style.display = isTeacher || isRoom ? "none" : "inline-flex";

  setStatus("");

  if (isTeacher) {
    teacherSelect.focus();
  } else if (isRoom) {
    roomSelect.focus();
    // Lazily populate the room list from the aggregator
    populateRoomSelectFromAggregator();
  }
};

const onModeChange = () => {
  const mode = modeSelect.value;
  updateModeVisibility();

  // Restore appropriate view if possible
  if (mode === "student") {
    fileCascade.triggerLoad();
  } else if (mode === "teacher") {
    if (teacherSelect.value) loadTeacherSchedule(teacherSelect.value);
  } else if (mode === "room") {
    if (roomSelect.value) loadRoomSchedule(roomSelect.value);
  }
};

const currentSelection = () => ({
  mode: modeSelect.value,
  ...fileCascade.getSelection(),
});

const persistCurrentSelection = () => {
  const sel = currentSelection();
  saveSelection(sel);
  writeUrlParams(sel);
};

const applyModeSelection = (modeValue) => {
  if (!modeValue) return;
  const allowed = ["student", "teacher", "room"];
  if (!allowed.includes(modeValue)) return;
  modeSelect.value = modeValue;
  updateModeVisibility();
};

const populateSelects = (files) => {
  fileCascade.setAvailableFiles(files);
  if (!fileCascade.getAvailableFiles().length) return;

  const params = mergeSelectionSources();
  applyModeSelection(params.mode);
  fileCascade.applyPartialSelection(params);
  fileCascade.triggerLoad();
};

const loadFileList = async () => {
  try {
    setStatus("Récupération de la liste des fichiers…");
    const html = await fetchFileListHtml();
    const files = extractIcsLinks(html);
    invalidateAggregateCache();
    state.isRoomSelectPopulated = false;
    populateSelects(files);
    if (!files.length) {
      populateTeacherSelect([]);
      setStatus("Aucun fichier .ics détecté.");
      return;
    }

    setSelectOptions(teacherSelect, "Chargement des professeurs…", [], true);
    setStatus("Chargement des professeurs…");
    const { error } = await loadTeacherList();
    if (error) {
      setStatus("Erreur lors du chargement des professeurs.");
      return;
    }
    setStatus("Liste chargée.");
  } catch (error) {
    setStatus(
      "Impossible de lire le dossier /output. Activez l'indexation des fichiers côté serveur ou fournissez une liste JSON."
    );
    populateSelects([]);
    populateTeacherSelect([]);
  }
};

// ===== Event wiring =====
teacherSelect.addEventListener("change", () =>
  loadTeacherSchedule(teacherSelect.value)
);
roomSelect.addEventListener("change", () =>
  loadRoomSchedule(roomSelect.value)
);
modeSelect.addEventListener("change", onModeChange);

prevWeekBtn.addEventListener("click", () => {
  if (!state.currentWeekStart) return;
  const next = new Date(state.currentWeekStart);
  next.setDate(next.getDate() - 7);
  state.currentWeekStart = next;
  renderWeek();
});

nextWeekBtn.addEventListener("click", () => {
  if (!state.currentWeekStart) return;
  const next = new Date(state.currentWeekStart);
  next.setDate(next.getDate() + 7);
  state.currentWeekStart = next;
  renderWeek();
});

$("todayBtn").addEventListener("click", () => {
  state.currentWeekStart = getWeekStart(new Date());
  renderWeek();
});

refreshBtn.addEventListener("click", loadFileList);

shareBtn.addEventListener("click", async () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const type = typeSelect.value;
  const rest = fileSelect.value;
  if (!year || !track || !type || !rest) {
    showToast("Sélectionne d'abord un emploi du temps complet.", { type: "error" });
    return;
  }
  const url = new URL(window.location);
  url.searchParams.set("year", year);
  url.searchParams.set("track", track);
  url.searchParams.set("type", type);
  url.searchParams.set("rest", rest);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast("Lien copié dans le presse-papier", { type: "success" });
  } catch (error) {
    showToast("Impossible de copier le lien : " + error.message, { type: "error" });
  }
});

downloadLink.addEventListener("click", (event) => {
  if (!downloadLink.href || downloadLink.href.endsWith("#")) {
    event.preventDefault();
  }
});

subscribeLink.addEventListener("click", (event) => {
  if (!subscribeLink.href || subscribeLink.href.endsWith("#")) {
    event.preventDefault();
    showToast("Charge d'abord un emploi du temps.", { type: "info" });
  }
});

// ===== Theme =====
const initTheme = () => {
  const isDark = localStorage.getItem("darkMode") === "true";
  if (isDark) {
    document.documentElement.classList.add("dark-mode");
    themeToggle.textContent = "☀️";
  }
};

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark-mode");
  const isDark = document.documentElement.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDark ? "true" : "false");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  invalidateColorCache();
  if (state.currentWeekStart) renderWeek();
});

// ===== Modal =====
initModal({ modalElement: eventModal, titleId: "eventTitle" });

const showEventModal = (event) => {
  state.currentEvent = event;
  eventTitle.textContent = event.summary || "(Sans titre)";

  const startStr = formatDateTime(event.start);
  const endStr = formatTimeOnly(event.end);
  const location = event.location || "Non spécifié";
  const description = event.description || "Aucune description";

  eventDetails.innerHTML = `
    <div class="event-detail-row">
      <span class="event-detail-label">Début :</span>
      <span class="event-detail-value">${escapeHtml(startStr)}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Fin :</span>
      <span class="event-detail-value">${escapeHtml(endStr)}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Lieu :</span>
      <span class="event-detail-value">${escapeHtml(location)}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Description :</span>
      <span class="event-detail-value">${escapeHtml(description)}</span>
    </div>
  `;

  openModal();
};

closeModalBtn.addEventListener("click", closeModal);

addToCalendarBtn.addEventListener("click", () => {
  if (!state.currentEvent) return;
  const icsContent = generateIcsEvent(state.currentEvent);
  const blob = new Blob([icsContent], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.currentEvent.summary || "event"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
});

// ===== Empty rooms feature =====
initEmptyRoomsFeature({
  buttonEl: emptyRoomsBtn,
  statusEl: emptyRoomsStatus,
  timeInputEl: emptyRoomsTime,
  getStudentFiles,
});

// ===== Next course (card displayed on mobile) =====
const nextCourseSection = $("nextCourseSection");
const nextCourseContent = $("nextCourseContent");

const getNextCourse = () => {
  const now = new Date();
  const upcoming = state.viewEvents.filter(
    (event) => new Date(event.start) > now
  );
  return upcoming.length ? upcoming[0] : null;
};

const updateNextCourse = () => {
  const nextEvent = getNextCourse();
  if (!nextEvent) {
    nextCourseSection.style.display = "none";
    return;
  }
  nextCourseSection.style.display = "block";
  const subjectType = getSubjectType(nextEvent.summary);
  const colors = getSubjectColors(nextEvent.summary);

  nextCourseContent.innerHTML = `
    <div class="next-course-event"
         data-subject-type="${escapeHtml(subjectType)}"
         style="--event-bg: ${colors.background}; --event-border: ${colors.border}; --event-text: ${colors.text}; --event-subtext: ${colors.subtext};">
      <h3 style="margin: 0 0 0.5rem;">${escapeHtml(nextEvent.summary || "(Sans titre)")}</h3>
      <p style="margin: 0.25rem 0; font-weight: 600;">${escapeHtml(formatDateTime(nextEvent.start))}</p>
      <p style="margin: 0.25rem 0; font-size: 0.9rem;">${escapeHtml(nextEvent.location || "Lieu non spécifié")}</p>
    </div>
  `;
};

// ===== Boot =====
loadFileList();
initTheme();
updateModeVisibility();

// ===== Service Worker (PWA) =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.log("Erreur Service Worker:", error);
    });
  });
}
