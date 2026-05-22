import {
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  getWeekStart,
  getWeekEnd,
} from "./utils/dates.js";
import { $, escapeHtml } from "./utils/dom.js";
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
  availableFiles: [],
  currentEvent: null,
  teacherEventsByName: new Map(),
  isTeacherListLoading: false,
  currentRoomName: null,
  isRoomSelectPopulated: false,
};

// ===== Helpers =====
const setStatus = (message) => {
  statusEl.textContent = message;
};

const setWeekLabel = (weekStart) => {
  const weekEnd = getWeekEnd(weekStart);
  weekLabelEl.textContent = `${formatDateOnly(weekStart)} - ${formatDateOnly(weekEnd)}`;
};

const isStudentType = (typeValue) =>
  String(typeValue || "").toLowerCase().includes("eleve");

const getStudentFiles = (items = state.availableFiles) => {
  const studentItems = items.filter((item) => isStudentType(item.type));
  const source = studentItems.length ? studentItems : items;
  return source.map((item) => item.file);
};

const getUnique = (values) =>
  [...new Set(values)].sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true })
  );

const setSelectOptions = (select, placeholderText, values, disabled = false) => {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  select.appendChild(placeholder);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.disabled = disabled || values.length === 0;
};

const normalizeFiles = (files) =>
  files
    .map((file) => {
      const base = file.replace(/\.ics$/i, "");
      const normalized = base.replace(/\s*-\s*/g, "-");
      const parts = normalized.split("-");
      const [year, track, type, ...restParts] = parts;
      return {
        file,
        year: year || "",
        track: track || "",
        type: type || "",
        rest: restParts.length ? restParts.join("-") : "(général)",
      };
    })
    .filter((item) => item.year && item.track && item.type);

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
    if (yearSelect.value && trackSelect.value && typeSelect.value && fileSelect.value) {
      loadSelectedFile();
    }
  } else if (mode === "teacher") {
    if (teacherSelect.value) loadTeacherSchedule(teacherSelect.value);
  } else if (mode === "room") {
    if (roomSelect.value) loadRoomSchedule(roomSelect.value);
  }
};

// ===== Cascading selects =====
const updateTrackOptions = () => {
  const year = yearSelect.value;
  const tracks = getUnique(
    state.availableFiles
      .filter((item) => item.year === year)
      .map((item) => item.track)
  );
  setSelectOptions(trackSelect, "Parcours…", tracks, !year);
  setSelectOptions(typeSelect, "Type…", [], true);
  setSelectOptions(fileSelect, "Suite…", [], true);
};

const updateTypeOptions = () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const types = getUnique(
    state.availableFiles
      .filter((item) => item.year === year && item.track === track)
      .map((item) => item.type)
  );
  setSelectOptions(typeSelect, "Type…", types, !track);
  setSelectOptions(fileSelect, "Suite…", [], true);
};

const updateFileOptions = () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const type = typeSelect.value;
  const rests = getUnique(
    state.availableFiles
      .filter(
        (item) =>
          item.year === year && item.track === track && item.type === type
      )
      .map((item) => item.rest)
  );
  setSelectOptions(fileSelect, "Suite…", rests, !type);
};

const loadSelectedFile = () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const type = typeSelect.value;
  const rest = fileSelect.value;
  if (!year || !track || !type || !rest) return;
  if (modeSelect.value === "student") teacherSelect.value = "";
  const match = state.availableFiles.find(
    (item) =>
      item.year === year &&
      item.track === track &&
      item.type === type &&
      item.rest === rest
  );
  if (match) {
    persistCurrentSelection();
    loadSchedule(match.file);
  }
};

const currentSelection = () => ({
  mode: modeSelect.value,
  year: yearSelect.value,
  track: trackSelect.value,
  type: typeSelect.value,
  rest: fileSelect.value,
});

const persistCurrentSelection = () => {
  const sel = currentSelection();
  saveSelection(sel);
  writeUrlParams(sel);
};

const applySelectionFromMatch = (match) => {
  yearSelect.value = match.year;
  updateTrackOptions();
  trackSelect.value = match.track;
  updateTypeOptions();
  typeSelect.value = match.type;
  updateFileOptions();
  fileSelect.value = match.rest;
};

const applyModeSelection = (modeValue) => {
  if (!modeValue) return;
  const allowed = ["student", "teacher", "room"];
  if (!allowed.includes(modeValue)) return;
  modeSelect.value = modeValue;
  updateModeVisibility();
};

const populateSelects = (files) => {
  state.availableFiles = normalizeFiles(files);
  if (!state.availableFiles.length) {
    setSelectOptions(yearSelect, "Aucun fichier ICS trouvé", [], true);
    setSelectOptions(trackSelect, "Parcours…", [], true);
    setSelectOptions(typeSelect, "Type…", [], true);
    setSelectOptions(fileSelect, "Suite…", [], true);
    return;
  }

  const years = getUnique(state.availableFiles.map((item) => item.year));
  setSelectOptions(yearSelect, "Année…", years, false);
  setSelectOptions(trackSelect, "Parcours…", [], true);
  setSelectOptions(typeSelect, "Type…", [], true);
  setSelectOptions(fileSelect, "Suite…", [], true);

  const params = mergeSelectionSources();
  applyModeSelection(params.mode);

  const matchFromParams =
    params.year && params.track && params.type && params.rest
      ? state.availableFiles.find(
          (item) =>
            item.year === params.year &&
            item.track === params.track &&
            item.type === params.type &&
            item.rest === params.rest
        )
      : null;

  if (matchFromParams) {
    applySelectionFromMatch(matchFromParams);
    loadSelectedFile();
    return;
  }

  if (params.year && years.includes(params.year)) {
    yearSelect.value = params.year;
    updateTrackOptions();
    if (params.track) {
      trackSelect.value = params.track;
      updateTypeOptions();
      if (params.type) {
        typeSelect.value = params.type;
        updateFileOptions();
        if (params.rest) {
          fileSelect.value = params.rest;
          loadSelectedFile();
        }
      }
    }
  }
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
yearSelect.addEventListener("change", updateTrackOptions);
trackSelect.addEventListener("change", updateTypeOptions);
typeSelect.addEventListener("change", updateFileOptions);
fileSelect.addEventListener("change", loadSelectedFile);
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
  getStudentFiles: () => getStudentFiles(state.availableFiles),
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
