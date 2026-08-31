<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getAggregatedEvents } from "../ics/aggregator.js";
import { formatTimeOnly, formatDateOnly } from "../utils/dates.js";

const emit = defineEmits(["close"]);

const KNOWN_ROOMS = [
  "A042", "A046", "A048", "A049", "A166",
  "B040", "B042", "B044", "B141", "B148", "B152",
  "C065", "C080", "D001", "D002", "D003", "D004"
];

const selectedDate = ref(new Date().toISOString().split("T")[0]);
const selectedTime = ref("14:00");

const isLoading = ref(false);
const emptyRooms = ref([]);
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

    // Find all occupied rooms at this time
    const occupiedRooms = new Set();

    for (const ev of allEvents) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);

      if (checkTime >= start && checkTime < end && ev.location) {
        const rooms = ev.location.split(",").map((r) => r.trim()).filter(Boolean);
        rooms.forEach((r) => occupiedRooms.add(r));
      }
    }

    // Free rooms
    const free = KNOWN_ROOMS.filter((room) => !occupiedRooms.has(room)).sort();
    emptyRooms.value = free;
  } catch (err) {
    console.error("Failed to calculate empty rooms:", err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h2>🚪 Salles vides</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">
          ✕
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-intro">
          Recherche instantanée des salles libres en croisant tous les plannings de l'école.
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
            {{ isLoading ? 'Recherche...' : 'Vérifier' }}
          </button>
        </div>

        <div v-if="isLoading" class="loading-state">
          <div class="skeleton" style="height: 120px; width: 100%;"></div>
        </div>

        <div v-else-if="searchPerformed" class="results-area">
          <div v-if="emptyRooms.length > 0" class="rooms-grid">
            <div v-for="room in emptyRooms" :key="room" class="room-pill">
              <span class="room-icon">📍</span>
              <span class="room-name">{{ room }}</span>
            </div>
          </div>
          <div v-else class="no-rooms">
            <p>Toutes les salles semblent occupées à ce créneau.</p>
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

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
  max-height: 240px;
  overflow-y: auto;
}

.room-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
