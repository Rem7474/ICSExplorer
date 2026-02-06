const outputBase = "https://edt.remcorp.fr/output/";

const yearSelect = document.getElementById("yearSelect");
const trackSelect = document.getElementById("trackSelect");
const typeSelect = document.getElementById("typeSelect");
const fileSelect = document.getElementById("fileSelect");
const teacherSelect = document.getElementById("teacherSelect");
const modeSelect = document.getElementById("modeSelect");
const studentControls = document.getElementById("studentControls");
const teacherControls = document.getElementById("teacherControls");
const roomControls = document.getElementById("roomControls");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const scheduleEl = document.getElementById("schedule");
const downloadLink = document.getElementById("downloadLink");
const shareBtn = document.getElementById("shareBtn");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const weekLabelEl = document.getElementById("weekLabel");

// Éléments pour recherche de salle
const roomSelect = document.getElementById("roomSelect");
const emptyRoomsBtn = document.getElementById("emptyRoomsBtn");
const roomModeStatus = document.getElementById("roomModeStatus");
const emptyRoomsStatus = document.getElementById("emptyRoomsStatus");
const roomScheduleContainer = document.getElementById("roomSchedule");
const roomTitle = document.getElementById("roomTitle");
const roomScheduleContent = document.getElementById("roomScheduleContent");

// Modal
const eventModal = document.getElementById("eventModal");
const eventTitle = document.getElementById("eventTitle");
const eventDetails = document.getElementById("eventDetails");
const closeModalBtn = document.getElementById("closeModal");
const addToCalendarBtn = document.getElementById("addToCalendarBtn");

// Theme toggle
const themeToggle = document.getElementById("themeToggle");

let allEvents = [];
let currentWeekStart = null;
let availableFiles = [];
let currentEvent = null;
let teacherEventsByName = new Map();
let isTeacherListLoading = false;

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
};

const formatTimeOnly = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const setWeekLabel = (weekStart) => {
  const weekEnd = getWeekEnd(weekStart);
  weekLabelEl.textContent = `${formatDateOnly(weekStart)} - ${formatDateOnly(weekEnd)}`;
};

const parseIcsDate = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, "");
  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  if (/^\d{8}T\d{6}Z$/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    const hour = cleaned.slice(9, 11);
    const minute = cleaned.slice(11, 13);
    const second = cleaned.slice(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  }

  if (/^\d{8}T\d{6}$/.test(cleaned)) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    const hour = cleaned.slice(9, 11);
    const minute = cleaned.slice(11, 13);
    const second = cleaned.slice(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  }

  return cleaned;
};

const decodeIcsValue = (value) => {
  if (!value) return value;
  return value
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
};

const parseIcs = (icsText) => {
  const events = [];
  const lines = icsText
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  let current = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const value = rest.join(":");
    const key = rawKey.split(";")[0].toUpperCase();

    switch (key) {
      case "SUMMARY":
        current.summary = decodeIcsValue(value);
        break;
      case "DTSTART":
        current.start = parseIcsDate(value);
        break;
      case "DTEND":
        current.end = parseIcsDate(value);
        break;
      case "LOCATION":
        current.location = decodeIcsValue(value);
        break;
      case "DESCRIPTION":
        current.description = decodeIcsValue(value);
        break;
      default:
        break;
    }
  }

  return events
    .filter((event) => event.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
};

const extractTeacherNames = (description) => {
  if (!description) return [];
  const match = description.match(/\bavec\b\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && !name.startsWith("*"))
    .map((name) => name.replace(/^\*+\s*/, "").trim())
    .filter(Boolean);
};

let HOUR_START = 8;
let HOUR_END = 18;
let HOURS_TOTAL = HOUR_END - HOUR_START;
let PX_PER_HOUR = 600 / HOURS_TOTAL;

const adjustHoursForMobile = (events) => {
  // Sur mobile seulement, adapter les heures au contenu
  if (window.innerWidth > 480) {
    // Desktop : toujours 8-18h
    HOUR_START = 8;
    HOUR_END = 18;
  } else {
    // Mobile : adapter au contenu
    if (!events.length) {
      HOUR_START = 8;
      HOUR_END = 18;
    } else {
      const hours = events.map(e => new Date(e.start).getHours());
      HOUR_START = Math.min(...hours);
      
      const endHours = events.map(e => new Date(e.end).getHours());
      HOUR_END = Math.max(...endHours);
    }
  }
  
  HOURS_TOTAL = HOUR_END - HOUR_START;
  PX_PER_HOUR = 600 / HOURS_TOTAL;
  
  // Toujours mettre à jour les variables CSS pour que le désktop soit bien à 8h
  document.documentElement.style.setProperty('--hour-start', HOUR_START);
  document.documentElement.style.setProperty('--hour-end', HOUR_END);
  document.documentElement.style.setProperty('--hours-total', HOURS_TOTAL);
  document.documentElement.style.setProperty('--px-per-hour', PX_PER_HOUR + 'px');
};

const getEventTop = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const relativeHours = hours - HOUR_START + minutes / 60;
  return Math.max(0, relativeHours * PX_PER_HOUR);
};

const getEventHeight = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMinutes = (endDate - startDate) / 60000;
  return Math.max(20, (durationMinutes / 60) * PX_PER_HOUR);
};

// Extracte le type de matière du summary (ex: "SN123 - Titre" → "SN")
const getSubjectType = (summary) => {
  if (!summary) return "";
  const match = summary.match(/^([A-Z]{2,3})/);
  return match ? match[1] : "";
};

const renderSchedule = (events) => {
  // Adapter les heures pour mobile si nécessaire
  adjustHoursForMobile(events);
  
  if (!events.length) {
    scheduleEl.innerHTML = "<p>Aucun événement pour cette semaine.</p>";
    return;
  }

  const grouped = events.reduce((acc, event) => {
    const dayKey = formatDateOnly(event.start);
    if (!acc.has(dayKey)) acc.set(dayKey, []);
    acc.get(dayKey).push(event);
    return acc;
  }, new Map());

  const daysInWeek = Array.from(grouped.keys());
  if (daysInWeek.length === 0) {
    scheduleEl.innerHTML = "<p>Aucun événement pour cette semaine.</p>";
    return;
  }

  const now = new Date();
  const todayKey = formatDateOnly(now);
  const isToday = daysInWeek.includes(todayKey);
  const currentHour = now.getHours();
  const isWithinBusinessHours = currentHour >= HOUR_START && currentHour < HOUR_END;
  const currentTimeTop = isToday && isWithinBusinessHours ? getEventTop(now) : null;

  scheduleEl.innerHTML = daysInWeek
    .map((day) => {
      const dayEvents = grouped.get(day);
      const eventElements = dayEvents
        .map((event) => {
          const summary = event.summary || "(Sans titre)";
          const timeRange = `${formatTimeOnly(event.start)} - ${formatTimeOnly(event.end)}`;
          const location = event.location ? `<strong>Lieu :</strong> ${event.location}` : "";
          const top = getEventTop(event.start);
          const height = getEventHeight(event.start, event.end);
          
          const subjectType = getSubjectType(summary);

          return `
            <div class="event" style="--event-top: ${top}px; --event-height: ${height}px;" data-event-summary="${summary}" data-event-day="${day}" data-subject-type="${subjectType}">
              <h3>${summary}</h3>
              <p>${timeRange}</p>
              ${location ? `<p>${location}</p>` : ""}
            </div>
          `;
        })
        .join("");

      const currentTimeIndicator =
        day === todayKey && currentTimeTop !== null
          ? `<div class="current-time-line" style="--indicator-top: ${currentTimeTop}px;"></div>`
          : "";

      const isTodayClass = day === todayKey ? "today" : "";

      return `
        <div class="day-group ${isTodayClass}">
          <div class="day-title">${day}</div>
          <div class="day-schedule">
            ${currentTimeIndicator}
            ${eventElements}
          </div>
        </div>
      `;
    })
    .join("");

  // Ajouter event listeners aux événements
  document.querySelectorAll(".schedule .event").forEach((el) => {
    el.addEventListener("click", (e) => {
      const summary = el.getAttribute("data-event-summary") || "";
      const dayLabel = el.getAttribute("data-event-day") || "";
      
      // Trouver l'événement correspondant dans allEvents
      const event = allEvents.find((ev) => 
        (ev.summary || "(Sans titre)") === summary &&
        formatDateOnly(ev.start) === dayLabel
      );
      
      if (event) {
        showEventModal(event);
      }
    });
    el.style.cursor = "pointer";
  });

  // Ajuster la hauteur de chaque .day-schedule en fonction de ses événements
  document.querySelectorAll(".day-schedule").forEach((schedule) => {
    const events = schedule.querySelectorAll(".event");
    if (events.length === 0) return;
    
    let maxBottom = 0;
    events.forEach((event) => {
      const top = parseFloat(event.style.getPropertyValue("--event-top")) || 0;
      const height = parseFloat(event.style.getPropertyValue("--event-height")) || 0;
      const bottom = top + height;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    
    // Ajouter un peu de padding pour éviter que le dernier événement touche le bord
    const minHeight = Math.max(maxBottom + 10, 300);
    schedule.style.minHeight = minHeight + "px";
  });
};

const setStatus = (message) => {
  statusEl.textContent = message;
};

const renderWeek = () => {
  if (!currentWeekStart) return;
  setWeekLabel(currentWeekStart);
  const weekEnd = getWeekEnd(currentWeekStart);
  const weekEvents = allEvents.filter((event) => {
    const start = new Date(event.start);
    return start >= currentWeekStart && start <= weekEnd;
  });
  renderSchedule(weekEvents);
  updateNextCourse();
};

const loadSchedule = async (fileName) => {
  if (!fileName) return;
  try {
    setStatus("Chargement de l'emploi du temps…");
    const fileUrl = `${outputBase}${encodeURIComponent(fileName)}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Impossible de récupérer le fichier.");
    const text = await response.text();
    allEvents = parseIcs(text);
    populateRoomSelect();
    if (allEvents.length) {
      currentWeekStart = getWeekStart(allEvents[0].start);
    } else {
      currentWeekStart = getWeekStart(new Date());
    }
    const today = new Date();
    const todayStart = getWeekStart(today);
    if (todayStart) currentWeekStart = todayStart;
    renderWeek();
    downloadLink.href = fileUrl;
    downloadLink.textContent = `Télécharger (${fileName})`;
    setStatus(`Chargé : ${fileName}`);
  } catch (error) {
    setStatus("Erreur lors du chargement du fichier ICS.");
    scheduleEl.innerHTML = "<p>Impossible d'afficher cet emploi du temps.</p>";
  }
};

const decodeTextWithFallback = async (response) => {
  const buffer = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
  return utf8;
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const decodeHtmlEntities = (value) => {
  if (!value) return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

const extractIcsLinks = (html) => {
  const links = Array.from(html.matchAll(/href=["']([^"']+\.ics)["']/gi)).map(
    (match) => match[1]
  );

  return [...new Set(links)]
    .map((link) => link.replace(/^.*\//, ""))
    .map((link) => decodeHtmlEntities(link))
    .map((link) => safeDecodeURIComponent(link))
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
};

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

const getUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));

const isStudentType = (typeValue) =>
  String(typeValue || "")
    .toLowerCase()
    .includes("eleve");

const getStudentFiles = (items) => {
  const studentItems = items.filter((item) => isStudentType(item.type));
  const source = studentItems.length ? studentItems : items;
  return source.map((item) => item.file);
};

const fetchIcsText = async (fileName) => {
  const fileUrl = `${outputBase}${encodeURIComponent(fileName)}`;
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error("Impossible de récupérer le fichier.");
  return decodeTextWithFallback(response);
};

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
            if (!teacherMap.has(teacherName)) {
              teacherMap.set(teacherName, []);
            }
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
  setSelectOptions(teacherSelect, "Professeur…", teacherNames, teacherNames.length === 0);
};

const loadTeacherList = async () => {
  if (isTeacherListLoading) return { count: 0, error: false };
  isTeacherListLoading = true;

  try {
    const studentFiles = getStudentFiles(availableFiles);
    if (!studentFiles.length) {
      populateTeacherSelect([]);
      return { count: 0, error: false };
    }

    teacherEventsByName = await buildTeacherIndexFromFiles(studentFiles);
    const teacherNames = getUnique(Array.from(teacherEventsByName.keys()));
    populateTeacherSelect(teacherNames);
    return { count: teacherNames.length, error: false };
  } catch (error) {
    populateTeacherSelect([]);
    return { count: 0, error: true };
  } finally {
    isTeacherListLoading = false;
  }
};

const loadTeacherSchedule = (teacherName) => {
  if (!teacherName) return;
  const events = teacherEventsByName.get(teacherName) || [];
  allEvents = events;
  populateRoomSelect();
  currentWeekStart = getWeekStart(new Date());
  renderWeek();
  downloadLink.href = "#";
  downloadLink.textContent = "Télécharger";
  setStatus(`Emploi du temps du professeur : ${teacherName}`);
};

const updateModeVisibility = () => {
  const isTeacherMode = modeSelect.value === "teacher";
  const isRoomMode = modeSelect.value === "room";

  studentControls.classList.toggle("is-hidden", isTeacherMode || isRoomMode);
  teacherControls.classList.toggle("is-hidden", !isTeacherMode);
  roomControls.classList.toggle("is-hidden", !isRoomMode);

  if (!isRoomMode) {
    roomScheduleContainer.style.display = "none";
    roomModeStatus.textContent = "";
  }

  if (isTeacherMode) {
    teacherSelect.focus();
  } else if (isRoomMode) {
    roomSelect.focus();
  }
};

const updateTrackOptions = () => {
  const year = yearSelect.value;
  const tracks = getUnique(
    availableFiles.filter((item) => item.year === year).map((item) => item.track)
  );
  setSelectOptions(trackSelect, "Parcours…", tracks, !year);
  setSelectOptions(typeSelect, "Type…", [], true);
  setSelectOptions(fileSelect, "Suite…", [], true);
};

const updateTypeOptions = () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const types = getUnique(
    availableFiles
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
    availableFiles
      .filter((item) => item.year === year && item.track === track && item.type === type)
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
  if (modeSelect.value === "student") {
    teacherSelect.value = "";
  }
  const match = availableFiles.find(
    (item) =>
      item.year === year &&
      item.track === track &&
      item.type === type &&
      item.rest === rest
  );
  if (match) {
    saveSelectionsToStorage();
    updateUrl();
    loadSchedule(match.file);
  }
};

const saveSelectionsToStorage = () => {
  localStorage.setItem(
    "edtSelection",
    JSON.stringify({
      year: yearSelect.value,
      track: trackSelect.value,
      type: typeSelect.value,
      rest: fileSelect.value,
    })
  );
};

const loadSelectionsFromStorage = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("edtSelection") || "{}");
    return saved;
  } catch {
    return {};
  }
};

const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    year: params.get("year"),
    track: params.get("track"),
    type: params.get("type"),
    rest: params.get("rest"),
  };
};

const updateUrl = () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const type = typeSelect.value;
  const rest = fileSelect.value;
  if (year && track && type && rest) {
    const url = new URL(window.location);
    url.searchParams.set("year", year);
    url.searchParams.set("track", track);
    url.searchParams.set("type", type);
    url.searchParams.set("rest", rest);
    window.history.replaceState({}, "", url);
  }
};

const populateSelects = (files) => {
  availableFiles = normalizeFiles(files);
  if (!availableFiles.length) {
    setSelectOptions(yearSelect, "Aucun fichier ICS trouvé", [], true);
    setSelectOptions(trackSelect, "Parcours…", [], true);
    setSelectOptions(typeSelect, "Type…", [], true);
    setSelectOptions(fileSelect, "Suite…", [], true);
    return;
  }

  const years = getUnique(availableFiles.map((item) => item.year));
  setSelectOptions(yearSelect, "Année…", years, false);
  setSelectOptions(trackSelect, "Parcours…", [], true);
  setSelectOptions(typeSelect, "Type…", [], true);
  setSelectOptions(fileSelect, "Suite…", [], true);

  const urlParams = getUrlParams();
  const saved = loadSelectionsFromStorage();
  
  const filteredUrlParams = Object.fromEntries(
    Object.entries(urlParams).filter(([, v]) => v !== null)
  );
  const params = { ...saved, ...filteredUrlParams };

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
    const response = await fetch(outputBase, { cache: "no-store" });
    if (!response.ok) throw new Error("Répertoire inaccessible");
    const html = await decodeTextWithFallback(response);
    const files = extractIcsLinks(html);
    populateSelects(files);
    if (!files.length) {
      populateTeacherSelect([]);
      setStatus("Aucun fichier .ics détecté.");
      return;
    }

    setSelectOptions(teacherSelect, "Chargement des professeurs…", [], true);
    setStatus("Chargement des professeurs…");
    const { count, error } = await loadTeacherList();
    if (error) {
      setStatus("Erreur lors du chargement des professeurs.");
      return;
    }

    setStatus(
      count
        ? `Liste chargée. Professeurs détectés : ${count}`
        : "Liste chargée. Aucun professeur détecté."
    );
  } catch (error) {
    setStatus(
      "Impossible de lire le dossier /output. Activez l'indexation des fichiers côté serveur ou fournissez une liste JSON."
    );
    populateSelects([]);
    populateTeacherSelect([]);
  }
};

yearSelect.addEventListener("change", () => {
  updateTrackOptions();
});

trackSelect.addEventListener("change", () => {
  updateTypeOptions();
});

typeSelect.addEventListener("change", () => {
  updateFileOptions();
});

fileSelect.addEventListener("change", () => {
  loadSelectedFile();
});

teacherSelect.addEventListener("change", () => {
  loadTeacherSchedule(teacherSelect.value);
});

modeSelect.addEventListener("change", () => {
  updateModeVisibility();
});

prevWeekBtn.addEventListener("click", () => {
  if (!currentWeekStart) return;
  const next = new Date(currentWeekStart);
  next.setDate(next.getDate() - 7);
  currentWeekStart = next;
  renderWeek();
});

nextWeekBtn.addEventListener("click", () => {
  if (!currentWeekStart) return;
  const next = new Date(currentWeekStart);
  next.setDate(next.getDate() + 7);
  currentWeekStart = next;
  renderWeek();
});

const todayBtn = document.getElementById("todayBtn");
todayBtn.addEventListener("click", () => {
  currentWeekStart = getWeekStart(new Date());
  renderWeek();
});

refreshBtn.addEventListener("click", loadFileList);

shareBtn.addEventListener("click", async () => {
  const year = yearSelect.value;
  const track = trackSelect.value;
  const type = typeSelect.value;
  const rest = fileSelect.value;
  
  if (!year || !track || !type || !rest) {
    alert("Veuillez d'abord sélectionner un emploi du temps complet.");
    return;
  }

  const url = new URL(window.location);
  url.searchParams.set("year", year);
  url.searchParams.set("track", track);
  url.searchParams.set("type", type);
  url.searchParams.set("rest", rest);
  const shareUrl = url.toString();

  try {
    await navigator.clipboard.writeText(shareUrl);
    const originalText = shareBtn.textContent;
    shareBtn.textContent = "Copié !";
    setTimeout(() => {
      shareBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    alert("Impossible de copier l'URL : " + error.message);
  }
});

downloadLink.addEventListener("click", (event) => {
  if (!downloadLink.href || downloadLink.href.endsWith("#")) {
    event.preventDefault();
  }
});

// ===== MODE SOMBRE =====
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
  // Les couleurs se changent automatiquement via CSS variables
});

// ===== MODAL ÉVÉNEMENT =====
const showEventModal = (event) => {
  currentEvent = event;
  eventTitle.textContent = event.summary || "(Sans titre)";
  
  const startStr = formatDateTime(event.start);
  const endStr = formatTimeOnly(event.end);
  const location = event.location || "Non spécifié";
  const description = event.description || "Aucune description";
  
  eventDetails.innerHTML = `
    <div class="event-detail-row">
      <span class="event-detail-label">Début :</span>
      <span class="event-detail-value">${startStr}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Fin :</span>
      <span class="event-detail-value">${endStr}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Lieu :</span>
      <span class="event-detail-value">${location}</span>
    </div>
    <div class="event-detail-row">
      <span class="event-detail-label">Description :</span>
      <span class="event-detail-value">${description}</span>
    </div>
  `;
  
  eventModal.style.display = "flex";
};

closeModalBtn.addEventListener("click", () => {
  eventModal.style.display = "none";
});

eventModal.addEventListener("click", (e) => {
  if (e.target === eventModal) {
    eventModal.style.display = "none";
  }
});

addToCalendarBtn.addEventListener("click", () => {
  if (!currentEvent) return;
  
  const icsContent = generateIcsEvent(currentEvent);
  const blob = new Blob([icsContent], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentEvent.summary || "event"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
});

const generateIcsEvent = (event) => {
  const formatIcsDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Edt Esisar//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatIcsDate(event.start)}
DTEND:${formatIcsDate(event.end)}
SUMMARY:${event.summary || "Événement"}
LOCATION:${event.location || ""}
DESCRIPTION:${event.description || ""}
END:VEVENT
END:VCALENDAR`;
};

// ===== RECHERCHE DE SALLE =====
const getAllRooms = () => {
  const rooms = new Set();
  allEvents.forEach((event) => {
    if (event.location) {
      rooms.add(event.location.trim());
    }
  });
  return Array.from(rooms).sort();
};

const populateRoomSelect = () => {
  const rooms = getAllRooms();
  setSelectOptions(roomSelect, "Salle…", rooms, rooms.length === 0);
};

const getEventsForRoom = (roomName, date = null) => {
  const targetDate = date || new Date();
  const dayKey = formatDateOnly(targetDate);
  
  return allEvents.filter((event) => {
    const eventDay = formatDateOnly(event.start);
    return event.location && 
           event.location.trim().toLowerCase() === roomName.toLowerCase() &&
           eventDay === dayKey;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
};

const renderRoomSchedule = (events, roomName) => {
  if (!events.length) {
    roomScheduleContent.innerHTML = "<p>Aucun événement dans cette salle pour ce jour.</p>";
    return;
  }

  roomTitle.textContent = `Salle : ${roomName}`;
  
  const eventElements = events
    .map((event) => {
      const timeRange = `${formatTimeOnly(event.start)} - ${formatTimeOnly(event.end)}`;
      const top = getEventTop(event.start);
      const height = getEventHeight(event.start, event.end);
      
      return `
        <div class="event" style="top: ${top}px; height: ${height}px;">
          <h3>${event.summary || "(Sans titre)"}</h3>
          <p>${timeRange}</p>
        </div>
      `;
    })
    .join("");

  roomScheduleContent.innerHTML = `
    <div class="day-schedule" style="margin-top: 1rem;">
      <div class="hour-grid">
        ${Array.from({ length: HOURS_TOTAL + 1 })
          .map(
            (_, i) =>
              `<div class="hour-line" style="top: ${i * PX_PER_HOUR}px;" title="${HOUR_START + i}h"></div>`
          )
          .join("")}
      </div>
      ${eventElements}
    </div>
  `;
  
  roomScheduleContainer.style.display = "block";
};

roomSelect.addEventListener("change", () => {
  const roomName = roomSelect.value.trim();
  if (!roomName) {
    roomModeStatus.textContent = "";
    roomScheduleContainer.style.display = "none";
    return;
  }

  const events = getEventsForRoom(roomName);
  if (events.length === 0) {
    roomModeStatus.textContent = `Aucun événement trouvé pour la salle "${roomName}".`;
    roomScheduleContainer.style.display = "none";
    return;
  }

  roomModeStatus.textContent = `${events.length} événement(s) trouvé(s) pour "${roomName}".`;
  renderRoomSchedule(events, roomName);
});

emptyRoomsBtn.addEventListener("click", () => {
  const now = new Date();
  const allRooms = getAllRooms();
  
  const emptyRooms = allRooms.filter((room) => {
    // Filtrer seulement les salles au format A/B/C/D suivi de chiffres/tirets (ex: A049, D130, B-201)
    const roomPattern = /^[ABCD][\d\-]+$/;
    if (!roomPattern.test(room)) {
      return false;
    }
    
    const events = allEvents.filter((event) => {
      const eventLocation = event.location ? event.location.trim().toLowerCase() : "";
      const isCurrentRoom = eventLocation === room.toLowerCase();
      const isNow = new Date(event.start) <= now && new Date(event.end) > now;
      return isCurrentRoom && isNow;
    });
    return events.length === 0;
  });
  
  if (emptyRooms.length === 0) {
    emptyRoomsStatus.textContent = "Aucune salle vide en ce moment (salles A, B, C, D).";
    roomScheduleContainer.style.display = "none";
    return;
  }
  
  emptyRoomsStatus.innerHTML = `
    <strong>${emptyRooms.length} salle(s) vide(s) en ce moment :</strong><br>
    ${emptyRooms.join(", ")}
  `;
  roomScheduleContainer.style.display = "none";
});

// ===== PROCHAIN COURS (MOBILE) =====
const nextCourseSection = document.getElementById("nextCourseSection");
const nextCourseContent = document.getElementById("nextCourseContent");

const getNextCourse = () => {
  const now = new Date();
  const upcomingEvents = allEvents.filter((event) => new Date(event.start) > now);
  if (upcomingEvents.length === 0) return null;
  return upcomingEvents[0];
};

const updateNextCourse = () => {
  const nextEvent = getNextCourse();
  if (!nextEvent) {
    nextCourseSection.style.display = "none";
    return;
  }

  nextCourseSection.style.display = "block";
  const subjectType = getSubjectType(nextEvent.summary);

  nextCourseContent.innerHTML = `
    <div class="next-course-event" data-subject-type="${subjectType}">
      <h3 style="margin: 0 0 0.5rem;">${nextEvent.summary || "(Sans titre)"}</h3>
      <p style="margin: 0.25rem 0; font-weight: 600;">${formatDateTime(nextEvent.start)}</p>
      <p style="margin: 0.25rem 0; font-size: 0.9rem;">${nextEvent.location || "Lieu non spécifié"}</p>
    </div>
  `;
};

loadFileList();
initTheme();
updateModeVisibility();

// ===== SERVICE WORKER (PWA) =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('Service Worker enregistré:', registration);
      })
      .catch((error) => {
        console.log('Erreur Service Worker:', error);
      });
  });
}
