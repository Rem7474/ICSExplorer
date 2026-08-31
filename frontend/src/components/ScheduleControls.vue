<script setup>
import { ref, computed, unref } from "vue";
import { fileUrl } from "../ics/api.js";
import { useFavorites } from "../composables/useFavorites.js";

const props = defineProps({
  schedule: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["openEmptyRooms"]);

const { isFavorited, toggleFavorite } = useFavorites();

const searchQuery = ref("");
const showSearchResults = ref(false);

// Generate current item key for favorites
const currentFavItem = computed(() => {
  const s = props.schedule;
  const mode = unref(s.selectedMode);
  const teacher = unref(s.selectedTeacher);
  const room = unref(s.selectedRoom);
  const file = unref(s.selectedFile);

  if (mode === "teacher" && teacher) {
    return { key: `teacher_${teacher}`, mode: "teacher", teacher, label: `Prof. ${teacher}` };
  }
  if (mode === "room" && room) {
    return { key: `room_${room}`, mode: "room", room, label: `Salle ${room}` };
  }
  if (file && typeof file === "string") {
    const label = file.replace(/\.ics$/i, "");
    return { key: `file_${file}`, mode: "student", file, label };
  }
  return null;
});

const isCurrentPinned = computed(() => {
  if (!currentFavItem.value) return false;
  return isFavorited(currentFavItem.value);
});

const onTogglePin = () => {
  if (currentFavItem.value) {
    toggleFavorite(currentFavItem.value);
  }
};

// Webcal and download URLs
const currentIcsUrl = computed(() => {
  const file = unref(props.schedule.selectedFile);
  if (!file || typeof file !== "string") return "#";
  return fileUrl(file);
});

const currentWebcalUrl = computed(() => {
  if (currentIcsUrl.value === "#") return "#";
  return currentIcsUrl.value.replace(/^https?:/, "webcal:");
});

// Quick Search Filtering
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results = [];
  const files = unref(props.schedule.availableFiles) || [];
  // Search in student files
  files.forEach((file) => {
    if (typeof file === "string") {
      const clean = file.replace(/\.ics$/i, "");
      if (clean.toLowerCase().includes(q)) {
        results.push({ type: "student", label: clean, value: file });
      }
    }
  });

  return results.slice(0, 10);
});

const selectSearchResult = (item) => {
  props.schedule.selectedMode = "student";
  props.schedule.loadSchedule(item.value);
  searchQuery.value = "";
  showSearchResults.value = false;
};

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("Lien copié dans le presse-papier !");
  } catch {
    prompt("Copiez ce lien :", window.location.href);
  }
};
</script>

<template>
  <div class="card controls-card">
    <div class="quick-search-row">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Recherche rapide (ex: 1A-Prépa, 3A-IN, Professeur...)"
          @focus="showSearchResults = true"
          @blur="setTimeout(() => (showSearchResults = false), 200)"
        />
        <div v-if="showSearchResults && searchResults.length > 0" class="search-dropdown">
          <div
            v-for="res in searchResults"
            :key="res.value"
            class="search-item"
            @mousedown="selectSearchResult(res)"
          >
            <span class="search-tag">{{ res.type === 'student' ? 'Élève' : res.type }}</span>
            <span class="search-label">{{ res.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="controls-grid">
      <!-- Mode selection -->
      <div class="control-group">
        <label for="modeSelect">Mode</label>
        <select id="modeSelect" v-model="schedule.selectedMode">
          <option value="student">Élève</option>
          <option value="teacher">Professeur</option>
          <option value="room">Salle</option>
        </select>
      </div>

      <!-- Student mode cascading selects -->
      <template v-if="schedule.selectedMode === 'student'">
        <div class="control-group">
          <label for="yearSelect">Année</label>
          <select id="yearSelect" v-model="schedule.selectedYear">
            <option value="">Année...</option>
            <option v-for="y in schedule.availableYears" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="trackSelect">Parcours</label>
          <select id="trackSelect" v-model="schedule.selectedTrack" :disabled="!schedule.selectedYear">
            <option value="">Parcours...</option>
            <option v-for="t in schedule.availableTracks" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="typeSelect">Type</label>
          <select id="typeSelect" v-model="schedule.selectedType" :disabled="!schedule.selectedTrack">
            <option value="">Type...</option>
            <option v-for="typ in schedule.availableTypes" :key="typ" :value="typ">{{ typ }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="fileSelect">Suite</label>
          <select
            id="fileSelect"
            v-model="schedule.selectedFile"
            :disabled="!schedule.selectedType"
            @change="schedule.loadSchedule(schedule.selectedFile)"
          >
            <option value="">Suite...</option>
            <option
              v-for="f in schedule.availableRestFiles"
              :key="f.fileName"
              :value="f.fileName"
            >
              {{ f.rest || f.fileName }}
            </option>
          </select>
        </div>
      </template>

      <!-- Teacher mode select -->
      <template v-else-if="schedule.selectedMode === 'teacher'">
        <div class="control-group span-3">
          <label for="teacherSelect">Professeur</label>
          <select
            id="teacherSelect"
            v-model="schedule.selectedTeacher"
            @change="schedule.loadTeacherSchedule(schedule.selectedTeacher)"
          >
            <option value="">Sélectionnez un enseignant...</option>
            <option v-for="t in schedule.availableTeachers" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </template>

      <!-- Room mode select -->
      <template v-else-if="schedule.selectedMode === 'room'">
        <div class="control-group span-3">
          <label for="roomSelect">Salle</label>
          <select
            id="roomSelect"
            v-model="schedule.selectedRoom"
            @change="schedule.loadRoomSchedule(schedule.selectedRoom)"
          >
            <option value="">Sélectionnez une salle...</option>
            <option v-for="r in schedule.availableRooms" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
      </template>
    </div>

    <!-- Actions toolbar -->
    <div class="actions-row">
      <button
        type="button"
        class="btn btn-outline"
        :class="{ 'btn-pinned': isCurrentPinned }"
        :title="isCurrentPinned ? 'Retirer des favoris' : 'Épingler dans la barre des favoris'"
        @click="onTogglePin"
      >
        {{ isCurrentPinned ? '★ Épinglé' : '☆ Épingler' }}
      </button>

      <button
        type="button"
        class="btn btn-outline"
        title="Rechercher des salles libres sur un créneau"
        @click="emit('openEmptyRooms')"
      >
        🚪 Salles vides
      </button>

      <a
        v-if="schedule.selectedFile"
        :href="currentIcsUrl"
        download
        class="btn btn-outline"
        title="Télécharger le fichier calendrier .ics brut"
      >
        📥 Télécharger
      </a>

      <a
        v-if="schedule.selectedFile"
        :href="currentWebcalUrl"
        class="btn btn-outline"
        title="Ajouter au calendrier Google / Apple (mise à jour auto)"
      >
        📅 S'abonner
      </a>

      <button
        type="button"
        class="btn btn-outline"
        title="Copier le lien partageable"
        @click="copyShareLink"
      >
        🔗 Partager
      </button>
    </div>
  </div>
</template>

<style scoped>
.controls-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quick-search-row {
  position: relative;
  width: 100%;
}

.search-box input {
  width: 100%;
  padding: 0.65rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s ease;
}

.search-box input:focus {
  border-color: var(--accent);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}

.search-item:last-child {
  border-bottom: none;
}

.search-item:hover {
  background: var(--bg);
}

.search-tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  background: var(--accent);
  color: white;
  border-radius: 4px;
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.control-group.span-3 {
  grid-column: span 3;
}

.control-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.control-group select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
}

.control-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.btn-pinned {
  background: rgba(37, 99, 235, 0.1);
  border-color: var(--accent);
  color: var(--accent);
}
</style>
