import { getAggregatedEvents } from "../ics/aggregator.js";
import { escapeHtml } from "../utils/dom.js";

const ROOM_RE = /\b([ABCD]\s*[\d-]+)\b/;

export const getRoomCode = (location) => {
  if (!location) return "";
  const m = location.toUpperCase().match(ROOM_RE);
  return m ? m[1].replace(/\s+/g, "") : "";
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

      const list = empty.map((code) => `<span class="room-chip">${escapeHtml(code)}</span>`).join(" ");
      statusEl.innerHTML = `<strong>${empty.length} salle(s) libre(s) ${escapeHtml(label)}</strong> (sur ${total}) :<div class="room-chips">${list}</div>`;
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Erreur lors de la recherche des salles vides.";
    } finally {
      buttonEl.disabled = false;
    }
  };

  buttonEl.addEventListener("click", run);
};
