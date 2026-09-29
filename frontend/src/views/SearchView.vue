<script setup>
import { computed, inject, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import {
  mdiMagnify, mdiCloseCircle, mdiSchool, mdiAccountSchoolOutline, mdiAccountOutline, mdiDoorOpen,
  mdiChevronRight, mdiStar, mdiCheck,
} from "@mdi/js";
import { useCatalogStore } from "../stores/catalog.js";
import { useScheduleStore } from "../stores/schedule.js";
import { usePersonalStore } from "../stores/personal.js";
import { useFavorites } from "../composables/useFavorites.js";
import { searchSchedules, promoLabel, groupBy, initialOf, buildingOf, MIN_QUERY_LENGTH } from "../utils/search.js";

// Rechercher: one search field for every schedule (promo, teacher, room),
// favorites, the personal ADE schedule, and browsable lists per category.
// Picking a schedule opens it on the Planning screen.
const catalog = useCatalogStore();
const schedule = useScheduleStore();
const personal = usePersonalStore();
const openPersonalSchedule = inject("openPersonalSchedule");
const router = useRouter();
const { favorites, removeFavorite } = useFavorites();

const { availableFiles, availableTeachers, availableRooms, parsedFiles, isAggregatorLoading, indexProgress } = storeToRefs(catalog);
const { selectedMode, selectedFile, selectedTeacher, selectedRoom } = storeToRefs(schedule);

// ------------------------------------------------------------ quick search
const inputRef = ref(null);
const query = ref("");
const activeIndex = ref(-1);
const trimmed = computed(() => query.value.trim());
const searching = computed(() => trimmed.value.length >= MIN_QUERY_LENGTH);
const results = computed(() =>
  searchSchedules({ files: availableFiles.value, teachers: availableTeachers.value, rooms: availableRooms.value }, query.value)
);
const activeDescendant = computed(() => (searching.value && activeIndex.value >= 0 ? `search-option-${activeIndex.value}` : undefined));

// The teacher/room index downloads every promo calendar: build it only once
// the user types a query or opens those lists.
const ensureIndex = () => {
  if (!availableTeachers.value.length) catalog.loadTeacherList();
  if (!availableRooms.value.length) catalog.loadRoomList();
};

watch(query, () => {
  activeIndex.value = -1;
  if (searching.value) ensureIndex();
});

const RESULT_ICONS = { student: mdiAccountSchoolOutline, teacher: mdiAccountOutline, room: mdiDoorOpen };
const RESULT_KINDS = { student: "Promo", teacher: "Professeur", room: "Salle" };

const open = (type, value) => {
  if (type === "teacher") schedule.loadTeacherSchedule(value);
  else if (type === "room") schedule.loadRoomSchedule(value);
  else schedule.loadSchedule(value);
};

const selectResult = (item) => {
  open(item.type, item.value);
  query.value = "";
};

const onKeydown = (e) => {
  const count = results.value.length;
  if (e.key === "ArrowDown" && count) {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % count;
  } else if (e.key === "ArrowUp" && count) {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + count) % count;
  } else if (e.key === "Enter" && searching.value && count) {
    e.preventDefault();
    selectResult(results.value[Math.max(0, activeIndex.value)]);
  } else if (e.key === "Escape" && query.value) {
    e.preventDefault();
    query.value = "";
  }
};

const clearQuery = () => {
  query.value = "";
  inputRef.value?.focus();
};

// Desktop: ready to type (Ctrl+K lands here). Phones: no keyboard pop-up.
onMounted(() => {
  if (window.matchMedia?.("(pointer: fine)").matches) inputRef.value?.focus();
});

// ------------------------------------------------------------ favorites
const FAV_ICONS = { personal: mdiSchool, teacher: mdiAccountOutline, room: mdiDoorOpen, student: mdiAccountSchoolOutline };
const currentKey = computed(() => {
  if (selectedMode.value === "personal") return "personal_edt";
  if (selectedMode.value === "teacher" && selectedTeacher.value) return `teacher_${selectedTeacher.value}`;
  if (selectedMode.value === "room" && selectedRoom.value) return `room_${selectedRoom.value}`;
  if (selectedMode.value === "student" && selectedFile.value) return `file_${selectedFile.value}`;
  return "";
});

const openFavorite = (fav) => {
  if (fav.mode === "personal") openPersonal();
  else open(fav.mode, fav.mode === "student" ? fav.file : fav.mode === "teacher" ? fav.teacher : fav.room);
};

// ------------------------------------------------------------ personal ADE
const hasPersonal = computed(
  () => Boolean(personal.personalScheduleInfo?.name) || Boolean(personal.getCachedIcs()) || personal.hasSavedCredentials()
);
const personalSubtitle = computed(() =>
  hasPersonal.value
    ? personal.personalScheduleInfo?.name || "Planning enregistré sur cet appareil"
    : "Connectez votre compte ADE (UGA, Grenoble INP…)"
);
const openPersonal = () => {
  if (!hasPersonal.value) openPersonalSchedule();
  // Already displayed: setMode() has nothing to load, just show it.
  else if (selectedMode.value === "personal" && schedule.events.length) router.push({ name: "planning", query: schedule.scheduleQuery });
  else schedule.setMode("personal");
};

// ------------------------------------------------------------ browse lists
const initialTab = { teacher: "teachers", room: "rooms" }[selectedMode.value] || "promos";
const tab = ref(initialTab);
watch(tab, (t) => (t === "teachers" || t === "rooms") && ensureIndex(), { immediate: true });

const years = computed(() => [...new Set(parsedFiles.value.map((f) => f.year).filter(Boolean))].sort());
const year = ref("");
watch(
  years,
  (list) => {
    if (list.includes(year.value)) return;
    const current = catalog.findFile(selectedFile.value)?.year;
    year.value = list.includes(current) ? current : list[0] || "";
  },
  { immediate: true }
);

const promoGroups = computed(() =>
  groupBy(
    parsedFiles.value.filter((f) => f.year === year.value),
    (f) => f.track || "Autres"
  )
);
const teacherGroups = computed(() => groupBy(availableTeachers.value, initialOf));
const roomGroups = computed(() =>
  groupBy(availableRooms.value, buildingOf).map((g) => ({ ...g, label: g.key === "Autres" ? "Autres salles" : `Bâtiment ${g.key}` }))
);

const indexLabel = computed(() =>
  indexProgress.value ? `Indexation des plannings (${indexProgress.value.loaded}/${indexProgress.value.total})…` : "Indexation des plannings…"
);
</script>

<template>
  <div class="search-screen">
    <div class="search-head">
      <div class="search-field">
        <v-icon :icon="mdiMagnify" size="22" class="search-icon" />
        <input
          id="quickSearchInput"
          ref="inputRef"
          v-model="query"
          type="search"
          role="combobox"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Rechercher un planning (promo, professeur ou salle)"
          aria-autocomplete="list"
          aria-controls="searchResults"
          :aria-expanded="searching"
          :aria-activedescendant="activeDescendant"
          placeholder="Promo, professeur, salle…"
          @keydown="onKeydown"
        />
        <button v-if="query" type="button" class="clear-btn" aria-label="Effacer la recherche" @click="clearQuery">
          <v-icon :icon="mdiCloseCircle" size="20" />
        </button>
      </div>
    </div>

    <!-- Search results -->
    <section v-if="searching" class="search-body" aria-live="polite">
      <ul v-if="results.length" id="searchResults" class="result-list" role="listbox" aria-label="Résultats de recherche">
        <li
          v-for="(res, idx) in results"
          :id="`search-option-${idx}`"
          :key="`${res.type}-${res.value}`"
          class="result-item"
          :class="{ active: idx === activeIndex }"
          role="option"
          :aria-selected="idx === activeIndex"
          @click="selectResult(res)"
          @mouseenter="activeIndex = idx"
        >
          <span class="result-icon" :class="`kind-${res.type}`"><v-icon :icon="RESULT_ICONS[res.type]" size="20" /></span>
          <span class="result-text">
            <span class="result-label">{{ res.label }}</span>
            <span class="result-kind">{{ RESULT_KINDS[res.type] }}</span>
          </span>
          <v-icon :icon="mdiChevronRight" size="20" class="chevron" />
        </li>
      </ul>
      <p v-if="isAggregatorLoading" class="search-status">
        <v-progress-circular indeterminate size="16" width="2" class="mr-2" />{{ indexLabel }}
      </p>
      <p v-else-if="!results.length" class="search-status">Aucun résultat pour « {{ trimmed }} »</p>
    </section>

    <div v-else class="search-body">
      <!-- Favorites -->
      <section v-if="favorites.length" class="block" aria-label="Favoris">
        <h2 class="block-title">Favoris</h2>
        <div class="fav-row">
          <v-chip
            v-for="fav in favorites"
            :key="fav.key"
            class="fav-chip"
            :class="{ current: fav.key === currentKey }"
            :prepend-icon="fav.key === currentKey ? mdiCheck : FAV_ICONS[fav.mode] || mdiStar"
            :color="fav.key === currentKey ? 'primary' : undefined"
            :variant="fav.key === currentKey ? 'flat' : 'tonal'"
            closable
            close-label="Retirer des favoris"
            @click="openFavorite(fav)"
            @click:close="removeFavorite(fav.key)"
          >
            {{ fav.label }}
          </v-chip>
        </div>
      </section>

      <!-- Personal ADE schedule -->
      <v-list class="block list-card" bg-color="transparent" lines="two">
        <v-list-item
          class="personal-item"
          :active="selectedMode === 'personal'"
          color="primary"
          :title="hasPersonal ? 'Mon planning ADE' : 'Ajouter mon planning ADE'"
          :subtitle="personalSubtitle"
          @click="openPersonal"
        >
          <template #prepend>
            <v-avatar color="primary" variant="tonal" rounded="lg"><v-icon :icon="mdiSchool" /></v-avatar>
          </template>
          <template #append>
            <v-icon :icon="mdiChevronRight" size="20" class="chevron" />
          </template>
        </v-list-item>
      </v-list>

      <!-- Browse by category -->
      <v-tabs v-model="tab" class="browse-tabs" grow color="primary" density="comfortable" aria-label="Parcourir les plannings">
        <v-tab value="promos">Promos</v-tab>
        <v-tab value="teachers">Profs</v-tab>
        <v-tab value="rooms">Salles</v-tab>
      </v-tabs>

      <section v-if="tab === 'promos'" class="browse">
        <v-chip-group v-if="years.length > 1" v-model="year" mandatory selected-class="year-selected" class="year-row" aria-label="Année">
          <v-chip v-for="y in years" :key="y" :value="y" variant="tonal" filter>{{ y }}</v-chip>
        </v-chip-group>
        <p v-if="!parsedFiles.length" class="search-status">Aucune promo disponible pour le moment.</p>
        <v-list v-for="group in promoGroups" :key="group.key" class="list-card" bg-color="transparent" density="comfortable">
          <v-list-subheader>{{ group.key }}</v-list-subheader>
          <v-list-item
            v-for="f in group.items"
            :key="f.fileName"
            class="browse-item"
            :active="selectedMode === 'student' && selectedFile === f.fileName"
            color="primary"
            :title="promoLabel(f)"
            @click="open('student', f.fileName)"
          >
            <template #append><v-icon :icon="mdiChevronRight" size="18" class="chevron" /></template>
          </v-list-item>
        </v-list>
      </section>

      <section v-else-if="tab === 'teachers'" class="browse">
        <p v-if="isAggregatorLoading && !availableTeachers.length" class="search-status">
          <v-progress-circular indeterminate size="16" width="2" class="mr-2" />{{ indexLabel }}
        </p>
        <p v-else-if="!availableTeachers.length" class="search-status">Aucun professeur trouvé.</p>
        <v-list v-for="group in teacherGroups" :key="group.key" class="list-card" bg-color="transparent" density="comfortable">
          <v-list-subheader>{{ group.key }}</v-list-subheader>
          <v-list-item
            v-for="t in group.items"
            :key="t"
            class="browse-item"
            :active="selectedMode === 'teacher' && selectedTeacher === t"
            color="primary"
            :title="t"
            @click="open('teacher', t)"
          >
            <template #append><v-icon :icon="mdiChevronRight" size="18" class="chevron" /></template>
          </v-list-item>
        </v-list>
      </section>

      <section v-else class="browse">
        <p v-if="isAggregatorLoading && !availableRooms.length" class="search-status">
          <v-progress-circular indeterminate size="16" width="2" class="mr-2" />{{ indexLabel }}
        </p>
        <p v-else-if="!availableRooms.length" class="search-status">Aucune salle trouvée.</p>
        <v-list v-for="group in roomGroups" :key="group.key" class="list-card" bg-color="transparent" density="comfortable">
          <v-list-subheader>{{ group.label }}</v-list-subheader>
          <v-list-item
            v-for="r in group.items"
            :key="r"
            class="browse-item"
            :active="selectedMode === 'room' && selectedRoom === r"
            color="primary"
            :title="`Salle ${r}`"
            @click="open('room', r)"
          >
            <template #append><v-icon :icon="mdiChevronRight" size="18" class="chevron" /></template>
          </v-list-item>
        </v-list>
      </section>
    </div>
  </div>
</template>

<style scoped>
.search-screen {
  width: min(720px, 100%);
  margin: 0 auto;
  padding-bottom: 1.5rem;
}

/* The search field stays reachable while the lists scroll. */
.search-head {
  position: sticky;
  top: var(--top-h);
  z-index: 2;
  padding: 10px 16px 8px;
  background: var(--bg);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 8px 0 12px;
  border-radius: 22px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.search-field:focus-within {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.search-field input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  /* 16px: iOS Safari zooms in on focused fields below this size. */
  font: inherit;
  font-size: 16px;
}

.search-field input::placeholder {
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.8;
}

/* Our own clear button replaces the WebKit one. */
.search-field input::-webkit-search-cancel-button {
  display: none;
}

.clear-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.search-body {
  padding: 0 16px;
}

.block {
  margin-bottom: 12px;
}

.block-title {
  margin: 6px 4px 8px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Favorites: one swipeable row of chips. */
.fav-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin: 0 -16px;
  padding-left: 16px;
  padding-right: 16px;
  scrollbar-width: none;
}

.fav-row::-webkit-scrollbar {
  display: none;
}

.fav-chip {
  flex: 0 0 auto;
}

.list-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 4px 0;
  margin-bottom: 12px;
  overflow: hidden;
}

.chevron {
  opacity: 0.45;
}

.browse-tabs {
  margin: 4px 0 12px;
  border-bottom: 1px solid var(--border);
}

.year-row {
  margin: -4px 0 8px;
}

.search-status {
  display: flex;
  align-items: center;
  margin: 16px 4px;
  font-size: 0.92rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Results: a plain list styled like Material list items. */
.result-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 6px 12px 6px 14px;
  cursor: pointer;
}

.result-item.active,
.result-item:active {
  background: rgba(var(--v-theme-primary), 0.08);
}

.result-icon {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.result-icon.kind-teacher {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.result-icon.kind-room {
  background: rgba(16, 185, 129, 0.14);
  color: #047857;
}

.result-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.result-label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-kind {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
