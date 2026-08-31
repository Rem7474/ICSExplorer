<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getAggregatedEvents } from "../ics/aggregator.js";
import { formatTimeOnly, formatDateOnly } from "../utils/dates.js";
import { useToast } from "../composables/useToast.js";

const emit = defineEmits(["close", "selectRoom"]);

const { showToast } = useToast();

const KNOWN_ROOMS = [
  "A042", "A046", "A048", "A049", "A166",
  "B040", "B042", "B044", "B141", "B148", "B152",
  "C065", "C080", "D001", "D002", "D003", "D004"
];

const BUILDINGS = [
  { id: "ALL", label: "Tous les bâtiments" },
  { id: "A", label: "Bât. A" },
  { id: "B", label: "Bât. B" },
  { id: "C", label: "Bât. C" },
  { id: "D", label: "Bât. D" },
];

const selectedBuilding = ref("ALL");
const selectedDate = ref(new Date().toISOString().split("T")[0]);
const selectedTime = ref("14:00");

const isLoading = ref(false);
const emptyRoomsData = ref([]);
const searchPerformed = ref(false);

const handleKeydown = (e) => {
  if (e.key === "Escape") {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, "0");
  selectedTime.value = `${hours}:${minutes}`;
  searchEmptyRooms();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const searchEmptyRooms = async () => {
  isLoading.value = true;
  searchPerformed.value = true;

  try {
    const allEvents = await getAggregatedEvents();

    const [y, m, d] = selectedDate.value.split("-").map(Number);
    const [hh, mm] = selectedTime.value.split(":").map(Number);
    const checkTime = new Date(y, m - 1, d, hh, mm, 0);

    const dayEndMidnight = new Date(y, m - 1, d, 23, 59, 59, 999);

    // Find all occupied rooms at this exact moment
    const occupiedRooms = new Set();
    // Index upcoming events for each room on this day
    const roomUpcomingEvents = new Map();

    for (const ev of allEvents) {
      if (!ev.location) continue;
      const start = new Date(ev.start);
      const end = new Date(ev.end);

      const rooms = ev.location.split(/[,;\/]/).map((r) => r.trim()).filter(Boolean);

      rooms.forEach((r) => {
        if (checkTime >= start && checkTime < end) {
          occupiedRooms.add(r);
        } else if (start > checkTime && start <= dayEndMidnight) {
          if (!roomUpcomingEvents.has(r)) {
            roomUpcomingEvents.set(r, []);
          }
          roomUpcomingEvents.get(r).push(ev);
        }
      });
    }

    // Process all free rooms with smart availability
    const freeRooms = KNOWN_ROOMS.filter((room) => !occupiedRooms.has(room)).map((room) => {
      const upcoming = roomUpcomingEvents.get(room) || [];
      upcoming.sort((a, b) => new Date(a.start) - new Date(b.start));

      let availabilityText = "Libre le reste de la journée";
      let isLimited = false;

      if (upcoming.length > 0) {
        const nextStart = new Date(upcoming[0].start);
        const diffMins = Math.round((nextStart - checkTime) / (1000 * 60));
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const durStr = hours > 0 ? `${hours}h${mins > 0 ? String(mins).padStart(2, "0") : ""}` : `${mins}min`;
        availabilityText = `Libre jusqu'à ${formatTimeOnly(nextStart)} (encore ${durStr})`;
        isLimited = true;
      }

      return {
        room,
        building: room[0] || "",
        availabilityText,
        isLimited,
      };
    });

    emptyRoomsData.value = freeRooms;
  } catch (err) {
    console.error("Failed to calculate empty rooms:", err);
  } finally {
    isLoading.value = false;
  }
};

const filteredRooms = computed(() => {
  if (selectedBuilding.value === "ALL") return emptyRoomsData.value;
  return emptyRoomsData.value.filter((r) => r.building === selectedBuilding.value);
});

// Backward-compatible emptyRooms array for tests/watchers
const emptyRooms = computed(() => filteredRooms.value.map((r) => r.room));

const onPickRoom = (room) => {
  emit("selectRoom", room);
  emit("close");
  showToast(`Planning de la salle ${room} chargé`, "info");
};
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h2>🚪 Salles vides en direct</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">
          ✕
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-intro">
          Disponibilité en temps réel calculée en croisant tous les emplois du temps de l'école.
        </p>

        <div class="filter-controls">
          <div class="field">
            <label for="roomDate">Date</label>
            <input id="roomDate" v-model="selectedDate" type="date" @change="searchEmptyRooms" />
          </div>

          <div class="field">
            <label for="roomTime">Heure</label>
            <input id="roomTime" v-model="selectedTime" type="time" step="900" @change="searchEmptyRooms" />
          </div>

          <button class="btn btn-primary" type="button" :disabled="isLoading" @click="searchEmptyRooms">
            {{ isLoading ? 'Recherche...' : '🔄 Actualiser' }}
          </button>
        </div>

        <!-- Building filter tabs -->
        <div class="building-tabs" role="tablist">
          <button
            v-for="b in BUILDINGS"
            :key="b.id"
            type="button"
            class="building-tab-btn"
            :class="{ active: selectedBuilding === b.id }"
            @click="selectedBuilding = b.id"
          >
            {{ b.label }}
          </button>
        </div>

        <div v-if="isLoading" class="loading-state">
          <div class="skeleton" style="height: 140px; width: 100%;"></div>
        </div>

        <div v-else-if="searchPerformed" class="results-area">
          <div v-if="filteredRooms.length > 0" class="rooms-grid">
            <div
              v-for="item in filteredRooms"
              :key="item.room"
              class="room-card"
              tabindex="0"
              role="button"
              :title="`Cliquer pour voir tout le planning de la salle ${item.room}`"
              @click="onPickRoom(item.room)"
              @keydown.enter="onPickRoom(item.room)"
            >
              <div class="room-card-header">
                <span class="room-pill">📍 {{ item.room }}</span>
                <span class="room-action-hint">Voir planning ➔</span>
              </div>
              <span class="room-avail-text" :class="{ 'avail-limited': item.isLimited }">
                {{ item.availabilityText }}
              </span>
            </div>
          </div>
          <div v-else class="no-rooms">
            <p>Aucune salle libre trouvée pour ce créneau dans cette sélection.</p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" type="button" @click="emit('close')">
          Fermer
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(580px, 100%);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: var(--muted);
  cursor: pointer;
}

.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-intro {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.filter-controls {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 130px;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.field input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
}

.building-tabs {
  display: flex;
  background: var(--bg);
  padding: 0.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  gap: 0.25rem;
  overflow-x: auto;
}

.building-tab-btn {
  flex: 1;
  min-width: fit-content;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.building-tab-btn:hover {
  color: var(--text);
}

.building-tab-btn.active {
  background: var(--card);
  color: var(--accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 2px;
}

.room-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.65rem 0.8rem;
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.room-card:hover {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.6);
  transform: translateY(-1px);
}

.room-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-pill {
  font-weight: 700;
  font-size: 1rem;
  color: #10b981;
}

.room-action-hint {
  font-size: 0.72rem;
  color: var(--muted);
  opacity: 0.8;
}

.room-avail-text {
  font-size: 0.78rem;
  color: var(--muted);
  font-weight: 500;
}

.room-avail-text.avail-limited {
  color: #059669;
  font-weight: 600;
}

:global(.dark-mode) .room-avail-text.avail-limited {
  color: #34d399;
}

.no-rooms {
  text-align: center;
  padding: 1.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
