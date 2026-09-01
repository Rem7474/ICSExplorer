import { getAggregatedEvents } from "../ics/aggregator.js";
import { escapeHtml } from "../utils/dom.js";

const ROOM_RE = /\b([ABCD]\s*[\d-]+)\b/;

export const getRoomCode = (location) => {
  if (!location) return "";
  const m = location.toUpperCase().match(ROOM_RE);
  return m ? m[1].replace(/\s+/g, "") : "";
};

const parseRoom = (code) => {
  const building = code[0];
  const digits = code.slice(1).replace(/-/g, "");
  const m = digits.match(/\d/);
  const floor = m ? Number.parseInt(m[0], 10) : null;
  return { building, floor, code };
};

const renderRoomGrid = (rooms) => {
  const byBuilding = new Map();
  for (const code of rooms) {
    const { building, floor } = parseRoom(code);
    if (!byBuilding.has(building)) byBuilding.set(building, new Map());
    const floors = byBuilding.get(building);
    const key = floor ?? "?";
    if (!floors.has(key)) floors.set(key, []);
    floors.get(key).push(code);
  }

  const buildings = [...byBuilding.keys()].sort();
  const columns = buildings
    .map((b) => {
      const floors = byBuilding.get(b);
      const floorKeys = [...floors.keys()].sort((a, z) => {
        if (a === "?") return 1;
        if (z === "?") return -1;
        return z - a;
      });
      const rows = floorKeys
        .map((f) => {
          const chips = floors
            .get(f)
            .sort()
            .map(
              (code) =>
                `<span class="room-chip room-chip-${b}">${escapeHtml(code)}</span>`
            )
            .join(" ");
          const label = f === "?" ? "?" : `Étage ${f}`;
          return `<div class="room-floor"><div class="room-floor-label">${label}</div><div class="room-floor-chips">${chips}</div></div>`;
        })
        .join("");
      return `<div class="room-building room-building-${b}"><div class="room-building-header">Bât. ${b}</div>${rows}</div>`;
    })
    .join("");

  return `<div class="room-grid">${columns}</div>`;
};

const smartDefaultCheckTime = (now = new Date()) => {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const t = new Date(now);
  if (hour < 8 || (hour === 8 && minute < 30)) {
    t.setHours(8, 30, 0, 0);
    return { time: t, label: "à 8h30" };
  }
  if ((hour >= 12 && hour < 13) || (hour === 13 && minute < 45)) {
    t.setHours(14, 0, 0, 0);
    return { time: t, label: "à 14h00" };
  }
  return { time: t, label: "maintenant" };
};

export const findEmptyRooms = async ({
  studentFiles,
  checkTime,
  allowedBuildings = ["A", "B", "C", "D"],
}) => {
  const events = await getAggregatedEvents(studentFiles);

  const occupations = new Map();
  for (const ev of events) {
    const code = getRoomCode(ev.location);
    if (!code) continue;
    if (!allowedBuildings.includes(code[0])) continue;
    if (!occupations.has(code)) occupations.set(code, []);
    occupations.get(code).push({
      start: new Date(ev.start),
      end: new Date(ev.end),
    });
  }

  const allRooms = [...occupations.keys()].sort();
  const target = checkTime.getTime();
  const empty = allRooms.filter((code) => {
    const slots = occupations.get(code);
    return !slots.some(
      (s) => s.start.getTime() <= target && s.end.getTime() > target
    );
  });

  return { empty, total: allRooms.length };
};

export const initEmptyRoomsFeature = ({
  buttonEl,
  statusEl,
  timeInputEl,
  getStudentFiles,
}) => {
  const resolveCheckTime = () => {
    if (timeInputEl && timeInputEl.value) {
      const [h, m] = timeInputEl.value.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const t = new Date();
        t.setHours(h, m, 0, 0);
        return { time: t, label: `à ${timeInputEl.value}` };
      }
    }
    return smartDefaultCheckTime();
  };

  const run = async () => {
    const files = getStudentFiles();
    if (!files.length) {
      statusEl.textContent = "Liste des fichiers indisponible.";
      return;
    }

    statusEl.textContent = "Recherche dans tous les emplois du temps…";
    buttonEl.disabled = true;

    try {
      const { time, label } = resolveCheckTime();
      const { empty, total } = await findEmptyRooms({
        studentFiles: files,
        checkTime: time,
      });

      if (total === 0) {
        statusEl.textContent =
          "Aucune salle détectée dans les emplois du temps.";
        return;
      }
      if (!empty.length) {
        statusEl.innerHTML = `<strong>Aucune salle libre ${escapeHtml(label)}</strong> (sur ${total} salles connues).`;
        return;
      }

      statusEl.innerHTML = `<strong>${empty.length} salle(s) libre(s) ${escapeHtml(label)}</strong> (sur ${total}) :${renderRoomGrid(empty)}`;
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Erreur lors de la recherche des salles vides.";
    } finally {
      buttonEl.disabled = false;
    }
  };

  buttonEl.addEventListener("click", run);
};
