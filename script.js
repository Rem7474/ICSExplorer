const outputBase = "https://edt.remcorp.fr/output/";

const yearSelect = document.getElementById("yearSelect");
const trackSelect = document.getElementById("trackSelect");
const typeSelect = document.getElementById("typeSelect");
const fileSelect = document.getElementById("fileSelect");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const scheduleEl = document.getElementById("schedule");
const downloadLink = document.getElementById("downloadLink");
const shareBtn = document.getElementById("shareBtn");
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");
const weekLabelEl = document.getElementById("weekLabel");

// Éléments pour recherche de salle
const roomInput = document.getElementById("roomInput");
const searchRoomBtn = document.getElementById("searchRoomBtn");
const emptyRoomsBtn = document.getElementById("emptyRoomsBtn");
const roomStatus = document.getElementById("roomStatus");
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
        current.summary = value;
        break;
      case "DTSTART":
        current.start = parseIcsDate(value);
        break;
      case "DTEND":
        current.end = parseIcsDate(value);
        break;
      case "LOCATION":
        current.location = value;
        break;
      case "DESCRIPTION":
        current.description = value;
        break;
      default:
        break;
    }
  }

  return events
    .filter((event) => event.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
};

const HOUR_START = 8;
const HOUR_END = 18;
const HOURS_TOTAL = HOUR_END - HOUR_START;
const PX_PER_HOUR = 600 / HOURS_TOTAL;

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

const renderSchedule = (events) => {
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
  const currentTimeTop = isToday ? getEventTop(now) : null;

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

          return `
            <div class="event" style="top: ${top}px; height: ${height}px;">
              <h3>${summary}</h3>
              <p>${timeRange}</p>
              ${location ? `<p>${location}</p>` : ""}
            </div>
          `;
        })
        .join("");

      const currentTimeIndicator =
        day === todayKey && currentTimeTop !== null
          ? `<div class="current-time-line" style="top: ${currentTimeTop}px;"></div>`
          : "";

      const isTodayClass = day === todayKey ? "today" : "";

      return `
        <div class="day-group ${isTodayClass}">
          <div class="day-title">${day}</div>
          <div class="day-schedule">
            <div class="hour-grid">
              ${Array.from({ length: HOURS_TOTAL + 1 })
                .map(
                  (_, i) =>
                    `<div class="hour-line" style="top: ${i * PX_PER_HOUR}px;" title="${HOUR_START + i}h"></div>`
                )
                .join("")}
            </div>
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
      const summary = el.querySelector("h3")?.textContent || "";
      const timeText = el.querySelector("p")?.textContent || "";
      
      // Trouver l'événement correspondant
      const event = dayEvents.find((ev) => 
        (ev.summary || "(Sans titre)") === summary
      );
      
      if (event) {
        showEventModal(event);
      }
    });
    el.style.cursor = "pointer";
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

const extractIcsLinks = (html) => {
  const links = Array.from(html.matchAll(/href=["']([^"']+\.ics)["']/gi)).map(
    (match) => match[1]
  );

  return [...new Set(links)]
    .map((link) => link.replace(/^.*\//, ""))
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
    setStatus(
      files.length
        ? "Liste chargée."
        : "Aucun fichier .ics détecté."
    );
  } catch (error) {
    setStatus(
      "Impossible de lire le dossier /output. Activez l'indexation des fichiers côté serveur ou fournissez une liste JSON."
    );
    populateSelects([]);
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

loadFileList();
