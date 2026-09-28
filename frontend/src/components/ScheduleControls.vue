<script setup>
import { ref, computed, unref, watch, onMounted, onUnmounted } from "vue";
import { useScheduleLinks } from "../composables/useScheduleLinks.js";
import { useFavorites } from "../composables/useFavorites.js";
import { useToast } from "../composables/useToast.js";

const props = defineProps({
  schedule: {
    type: Object,
    required: true,
  },
  // The app shell moves these actions to the top bar and the "Plus" screen.
  showActions: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["openEmptyRooms", "openPersonalSchedule"]);

const { isFavorited, toggleFavorite } = useFavorites();
const { showToast } = useToast();

const searchInputRef = ref(null);
const searchQuery = ref("");
const showSearchResults = ref(false);
const activeResultIndex = ref(-1);

const handleGlobalKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    searchInputRef.value?.focus();
    showSearchResults.value = true;
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});

// Generate current item key for favorites
const currentFavItem = computed(() => {
  const s = props.schedule;
  const mode = unref(s.selectedMode);
  const teacher = unref(s.selectedTeacher);
  const room = unref(s.selectedRoom);
  const file = unref(s.selectedFile);

  if (mode === "personal") {
    return {
      key: "personal_edt",
      mode: "personal",
      label: s.personalScheduleInfo?.name || "Mon Planning ADE",
    };
  }
  if (mode === "teacher" && teacher) {
    return { key: `teacher_${teacher}`, mode: "teacher", teacher, label: `Prof. ${teacher}` };
  }
  if (mode === "room" && room) {
    return { key: `room_${room}`, mode: "room", room, label: `Salle ${room}` };
  }
  if (mode === "student" && file && typeof file === "string") {
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
    showToast(isCurrentPinned.value ? "Ajouté aux favoris !" : "Retiré des favoris", "info");
  }
};

const isStudentMode = computed(() => unref(props.schedule.selectedMode) === "student");
const isPersonalMode = computed(() => unref(props.schedule.selectedMode) === "personal");
const isTeacherMode = computed(() => unref(props.schedule.selectedMode) === "teacher");
const isRoomMode = computed(() => unref(props.schedule.selectedMode) === "room");

const availableYears = computed(() => unref(props.schedule.availableYears) || []);
const availableTracks = computed(() => unref(props.schedule.availableTracks) || []);
const availableTypes = computed(() => unref(props.schedule.availableTypes) || []);
const availableRestFiles = computed(() => unref(props.schedule.availableRestFiles) || []);
const availableTeachers = computed(() => unref(props.schedule.availableTeachers) || []);
const availableRooms = computed(() => unref(props.schedule.availableRooms) || []);
const personalScheduleInfo = computed(() => unref(props.schedule.personalScheduleInfo) || null);
const baseSchedule = computed(() => unref(props.schedule.baseSchedule) || null);
const baseScheduleName = computed(() => baseSchedule.value?.name || "");

const hasPersonalConfig = computed(() => {
  const meta = personalScheduleInfo.value;
  return Boolean(meta?.name && (meta?.universityId || meta?.resourceId || props.schedule.rawPersonalIcs || localStorage.getItem("edt_cached_personal_ics") || localStorage.getItem("edtPersonalCreds")));
});

const onSelectStudentTab = () => {
  if (typeof props.schedule.setMode === "function") {
    props.schedule.setMode("student");
  } else {
    props.schedule.selectedMode = "student";
    const file = props.schedule.selectedFile || props.schedule.availableFiles?.[0];
    if (file && props.schedule.loadSchedule) {
      props.schedule.loadSchedule(file);
    }
  }
};

const onSelectPersonalTab = () => {
  if (typeof props.schedule.setMode === "function") {
    props.schedule.setMode("personal");
  } else {
    props.schedule.selectedMode = "personal";
  }
  if (!hasPersonalConfig.value) {
    emit("openPersonalSchedule");
  }
};

const onSelectTeacherTab = () => {
  if (typeof props.schedule.setMode === "function") {
    props.schedule.setMode("teacher");
  } else {
    props.schedule.selectedMode = "teacher";
    if (props.schedule.selectedTeacher && props.schedule.loadTeacherSchedule) {
      props.schedule.loadTeacherSchedule(props.schedule.selectedTeacher);
    }
  }
};

const onSelectRoomTab = () => {
  if (typeof props.schedule.setMode === "function") {
    props.schedule.setMode("room");
  } else {
    props.schedule.selectedMode = "room";
    if (props.schedule.selectedRoom && props.schedule.loadRoomSchedule) {
      props.schedule.loadRoomSchedule(props.schedule.selectedRoom);
    }
  }
};

const onLoadStudentSchedule = () => {
  const file = unref(props.schedule.selectedFile);
  if (file && props.schedule.loadSchedule) {
    props.schedule.loadSchedule(file);
  }
};

const onTeacherSelectChange = () => {
  const teacher = unref(props.schedule.selectedTeacher);
  if (!teacher) {
    if (typeof props.schedule.returnToBaseSchedule === "function") {
      props.schedule.returnToBaseSchedule();
    }
  } else if (props.schedule.loadTeacherSchedule) {
    props.schedule.loadTeacherSchedule(teacher);
  }
};

const onRoomSelectChange = () => {
  const room = unref(props.schedule.selectedRoom);
  if (!room) {
    if (typeof props.schedule.returnToBaseSchedule === "function") {
      props.schedule.returnToBaseSchedule();
    }
  } else if (props.schedule.loadRoomSchedule) {
    props.schedule.loadRoomSchedule(room);
  }
};


const { canCopyIcsLink, currentIcsUrl, webcalUrl, copyIcsLink, copyShareLink } = useScheduleLinks(props.schedule);


// Quick Search Filtering
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results = [];
  const files = unref(props.schedule.availableFiles) || [];
  files.forEach((file) => {
    if (typeof file === "string") {
      const clean = file.replace(/\.ics$/i, "");
      if (clean.toLowerCase().includes(q)) {
        results.push({ type: "student", label: clean, value: file });
      }
    }
  });

  const teachers = unref(props.schedule.availableTeachers) || [];
  teachers.forEach((teacher) => {
    if (typeof teacher === "string" && teacher.toLowerCase().includes(q)) {
      results.push({ type: "teacher", label: `Prof. ${teacher}`, value: teacher });
    }
  });

  const rooms = unref(props.schedule.availableRooms) || [];
  rooms.forEach((room) => {
    if (typeof room === "string" && room.toLowerCase().includes(q)) {
      results.push({ type: "room", label: `Salle ${room}`, value: room });
    }
  });

  return results.slice(0, 10);
});

const MIN_QUERY_LENGTH = 2;
const trimmedQuery = computed(() => searchQuery.value.trim());
const showSearchPanel = computed(() => showSearchResults.value && trimmedQuery.value.length >= MIN_QUERY_LENGTH);
const isIndexing = computed(() => Boolean(unref(props.schedule.isAggregatorLoading)));
const indexProgress = computed(() => unref(props.schedule.indexProgress) || null);
const activeDescendant = computed(() =>
  showSearchPanel.value && activeResultIndex.value >= 0 ? `quick-search-option-${activeResultIndex.value}` : undefined
);

// Building the teacher/room index downloads every promo calendar, so it only
// starts once the user actually types a query (not on mere focus).
const ensureSearchIndex = () => {
  if (props.schedule.loadTeacherList && !unref(props.schedule.availableTeachers)?.length) {
    props.schedule.loadTeacherList();
  }
  if (props.schedule.loadRoomList && !unref(props.schedule.availableRooms)?.length) {
    props.schedule.loadRoomList();
  }
};

watch(searchQuery, (q) => {
  activeResultIndex.value = -1;
  if (q.trim().length >= MIN_QUERY_LENGTH) {
    showSearchResults.value = true;
    ensureSearchIndex();
  }
});

const onSearchFocus = () => {
  showSearchResults.value = true;
};

const onSearchBlur = () => {
  // Delay so a click on a result registers before the list is removed.
  window.setTimeout(() => {
    showSearchResults.value = false;
  }, 150);
};

const onSearchKeydown = (e) => {
  const count = searchResults.value.length;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      showSearchResults.value = true;
      if (count) activeResultIndex.value = (activeResultIndex.value + 1) % count;
      break;
    case "ArrowUp":
      e.preventDefault();
      if (count) activeResultIndex.value = (activeResultIndex.value - 1 + count) % count;
      break;
    case "Enter":
      if (showSearchPanel.value && count) {
        e.preventDefault();
        selectSearchResult(searchResults.value[Math.max(0, activeResultIndex.value)]);
      }
      break;
    case "Escape":
      if (showSearchPanel.value) {
        e.preventDefault();
        showSearchResults.value = false;
        activeResultIndex.value = -1;
      }
      break;
    default:
      break;
  }
};

const searchTypeLabel = (type) => ({ student: "Élève", teacher: "Prof", room: "Salle" })[type] || type;

const selectSearchResult = (item) => {
  if (item.type === "teacher") {
    props.schedule.selectedMode = "teacher";
    props.schedule.selectedTeacher = item.value;
    props.schedule.loadTeacherSchedule(item.value);
  } else if (item.type === "room") {
    props.schedule.selectedMode = "room";
    props.schedule.selectedRoom = item.value;
    props.schedule.loadRoomSchedule(item.value);
  } else {
    props.schedule.selectedMode = "student";
    props.schedule.loadSchedule(item.value);
  }
  searchQuery.value = "";
  showSearchResults.value = false;
  activeResultIndex.value = -1;
  showToast(`Planning chargé : ${item.label}`, "success");
};

</script>

<template>
  <div class="card controls-card">
    <!-- Mode Tabs Segmented Control -->
    <div class="mode-tabs" role="tablist" aria-label="Mode d'affichage de l'emploi du temps">
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: isStudentMode }"
        role="tab"
        :aria-selected="isStudentMode"
        @click="onSelectStudentTab"
      >
        <i class="pi pi-users tab-icon" aria-hidden="true"></i>
        <span class="tab-label-desktop">Élèves (Promos)</span>
        <span class="tab-label-mobile">Promos</span>
      </button>
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: isPersonalMode }"
        role="tab"
        :aria-selected="isPersonalMode"
        @click="onSelectPersonalTab"
      >
        <i class="pi pi-calendar tab-icon" aria-hidden="true"></i>
        <span class="tab-label-desktop">Mon Planning ADE</span>
        <span class="tab-label-mobile">Mon ADE</span>
      </button>
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: isTeacherMode }"
        role="tab"
        :aria-selected="isTeacherMode"
        @click="onSelectTeacherTab"
      >
        <i class="pi pi-user tab-icon" aria-hidden="true"></i>
        <span class="tab-label-desktop">Professeurs</span>
        <span class="tab-label-mobile">Profs</span>
      </button>
      <button
        type="button"
        class="mode-tab-btn"
        :class="{ active: isRoomMode }"
        role="tab"
        :aria-selected="isRoomMode"
        @click="onSelectRoomTab"
      >
        <i class="pi pi-building tab-icon" aria-hidden="true"></i>
        <span>Salles</span>
      </button>
    </div>

    <div class="quick-search-row">
      <div class="search-box">
        <label for="quickSearchInput" class="sr-only">Rechercher un planning (promo, professeur ou salle)</label>
        <input
          id="quickSearchInput"
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          aria-controls="quickSearchListbox"
          :aria-expanded="showSearchPanel"
          :aria-activedescendant="activeDescendant"
          placeholder="🔍 Promo, professeur, salle…"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
          @keydown="onSearchKeydown"
        />
        <kbd v-if="!searchQuery" class="search-kbd" aria-hidden="true">Ctrl K</kbd>
        <div v-if="showSearchPanel" class="search-dropdown">
          <ul
            v-if="searchResults.length > 0"
            id="quickSearchListbox"
            class="search-list"
            role="listbox"
            aria-label="Résultats de recherche"
          >
            <li
              v-for="(res, idx) in searchResults"
              :id="`quick-search-option-${idx}`"
              :key="`${res.type}-${res.value}`"
              class="search-item"
              :class="{ active: idx === activeResultIndex }"
              role="option"
              :aria-selected="idx === activeResultIndex"
              :title="res.label"
              @mousedown.prevent="selectSearchResult(res)"
              @mouseenter="activeResultIndex = idx"
            >
              <span class="search-tag">{{ searchTypeLabel(res.type) }}</span>
              <span class="search-label">{{ res.label }}</span>
            </li>
          </ul>
          <p v-if="isIndexing" class="search-status" aria-live="polite">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            Indexation des professeurs et salles{{ indexProgress ? ` (${indexProgress.loaded}/${indexProgress.total} plannings)` : "" }}…
          </p>
          <p v-else-if="searchResults.length === 0" class="search-status" aria-live="polite">
            Aucun résultat pour « {{ trimmedQuery }} »
          </p>
        </div>
      </div>
    </div>

    <div class="controls-grid">
      <!-- Hidden Accessible Select for backward compatibility / tests -->
      <select id="modeSelect" v-model="schedule.selectedMode" class="sr-only" aria-hidden="true">
        <option value="student">Élève (Promos)</option>
        <option value="personal">🎓 Mon Planning ADE</option>
        <option value="teacher">Professeur</option>
        <option value="room">Salle</option>
      </select>

      <!-- Personal mode dedicated view -->
      <template v-if="isPersonalMode">
        <!-- Configured Personal Schedule Card -->
        <div v-if="hasPersonalConfig" class="personal-status-card span-3">
          <div class="personal-status-header">
            <div class="personal-status-main">
              <span class="personal-badge">Planning Actif</span>
              <h3 class="personal-title" :title="personalScheduleInfo?.name || 'EDT Personnel'">{{ personalScheduleInfo?.name || 'EDT Personnel' }}</h3>
            </div>
            <div class="personal-meta-tags">
              <span v-if="personalScheduleInfo?.universityName" class="meta-tag">
                <i class="pi pi-building mr-1" aria-hidden="true"></i> {{ personalScheduleInfo.universityName }}
              </span>
              <span v-if="personalScheduleInfo?.lastUpdated" class="meta-tag">
                <i class="pi pi-clock mr-1" aria-hidden="true"></i> Mis à jour à {{ personalScheduleInfo.lastUpdated }}
              </span>
            </div>
          </div>

          <div class="personal-actions-row">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              title="Actualiser les cours depuis ADE"
              :disabled="schedule.isLoading"
              @click="schedule.refreshPersonalSchedule"
            >
              <i class="pi pi-sync mr-1" aria-hidden="true"></i> Actualiser
            </button>

            <button
              type="button"
              class="btn btn-outline btn-sm"
              title="Changer d'EDT ou d'identifiants"
              @click="emit('openPersonalSchedule')"
            >
              <i class="pi pi-sitemap mr-1" aria-hidden="true"></i> Changer de planning
            </button>

            <button
              type="button"
              class="btn btn-outline btn-sm"
              title="Télécharger l'emploi du temps au format .ics"
              @click="schedule.downloadPersonalIcs"
            >
              <i class="pi pi-download mr-1" aria-hidden="true"></i> Télécharger .ics
            </button>

            <button
              type="button"
              class="btn btn-outline btn-sm btn-danger-soft"
              title="Revenir aux plannings des promotions de l'école"
              @click="schedule.clearPersonalSchedule"
            >
              <i class="pi pi-times mr-1" aria-hidden="true"></i> Mode promos Esisar
            </button>
          </div>
        </div>

        <!-- Unconfigured Personal Schedule Onboarding Card -->
        <div v-else class="personal-unconfigured-card span-3">
          <div class="unconfigured-content">
            <div class="unconfigured-icon"><i class="pi pi-calendar-plus text-primary text-2xl"></i></div>
            <div class="unconfigured-info">
              <h3 class="unconfigured-title">Mon Planning Personnel ADE</h3>
              <p class="unconfigured-desc">
                Aucun emploi du temps personnel n'est configuré sur cet appareil. Connectez votre compte ADE (UGA, Grenoble INP, etc.) pour explorer et afficher votre planning personnalisé.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-configure"
              @click="emit('openPersonalSchedule')"
            >
              <i class="pi pi-sparkles mr-1" aria-hidden="true"></i> Configurer mon planning ADE
            </button>
          </div>
        </div>
      </template>

      <!-- Student mode cascading selects -->
      <template v-else-if="isStudentMode">
        <div class="control-group">
          <label for="yearSelect">Année</label>
          <select id="yearSelect" v-model="schedule.selectedYear">
            <option value="">Année...</option>
            <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="trackSelect">Parcours</label>
          <select id="trackSelect" v-model="schedule.selectedTrack" :disabled="!schedule.selectedYear">
            <option value="">Parcours...</option>
            <option v-for="t in availableTracks" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="typeSelect">Type</label>
          <select id="typeSelect" v-model="schedule.selectedType" :disabled="!schedule.selectedTrack">
            <option value="">Type...</option>
            <option v-for="typ in availableTypes" :key="typ" :value="typ">{{ typ }}</option>
          </select>
        </div>

        <div class="control-group">
          <label for="fileSelect">Suite</label>
          <div class="select-with-btn-row">
            <select
              id="fileSelect"
              v-model="schedule.selectedFile"
              :disabled="!schedule.selectedType"
              @change="schedule.loadSchedule(schedule.selectedFile)"
            >
              <option value="">Suite...</option>
              <option
                v-for="f in availableRestFiles"
                :key="f.fileName"
                :value="f.fileName"
              >
                {{ f.rest || f.fileName }}
              </option>
            </select>
            <button
              type="button"
              class="btn btn-primary btn-load-action"
              :disabled="!unref(schedule.selectedFile) || unref(schedule.isLoading)"
              title="Charger l'emploi du temps de cette promotion"
              aria-label="Charger l'emploi du temps de cette promotion"
              @click="onLoadStudentSchedule"
            >
              <i class="pi" :class="schedule.isLoading ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>
              <span class="btn-load-text">Charger</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Teacher mode select -->
      <template v-else-if="isTeacherMode">
        <div class="control-group span-3">
          <div class="control-header-row">
            <label for="teacherSelect">Professeur</label>
            <button
              type="button"
              class="btn-return-link"
              title="Revenir à mon emploi du temps principal"
              @click="schedule.returnToBaseSchedule ? schedule.returnToBaseSchedule() : onSelectStudentTab()"
            >
              <i class="pi pi-arrow-left" aria-hidden="true"></i> Revenir à mon planning{{ baseScheduleName ? ` (${baseScheduleName})` : '' }}
            </button>
          </div>
          <div class="select-with-btn-row">
            <select
              id="teacherSelect"
              v-model="schedule.selectedTeacher"
              :disabled="schedule.isAggregatorLoading && availableTeachers.length === 0"
              @change="onTeacherSelectChange"
            >
              <option v-if="schedule.isAggregatorLoading && availableTeachers.length === 0" value="" disabled>
                Chargement des professeurs...
              </option>
              <option v-else value="">
                {{ availableTeachers.length ? 'Sélectionnez un enseignant...' : 'Aucun enseignant trouvé' }}
              </option>
              <option v-for="t in availableTeachers" :key="t" :value="t">{{ t }}</option>
            </select>
            <button
              type="button"
              class="btn btn-primary btn-load-action"
              :disabled="!unref(schedule.selectedTeacher) || unref(schedule.isLoading)"
              title="Charger l'emploi du temps de cet enseignant"
              aria-label="Charger l'emploi du temps de cet enseignant"
              @click="onTeacherSelectChange"
            >
              <i class="pi" :class="schedule.isLoading ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>
              <span class="btn-load-text">Charger</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Room mode select -->
      <template v-else-if="isRoomMode">
        <div class="control-group span-3">
          <div class="control-header-row">
            <label for="roomSelect">Salle</label>
            <button
              type="button"
              class="btn-return-link"
              title="Revenir à mon emploi du temps principal"
              @click="schedule.returnToBaseSchedule ? schedule.returnToBaseSchedule() : onSelectStudentTab()"
            >
              <i class="pi pi-arrow-left" aria-hidden="true"></i> Revenir à mon planning{{ baseScheduleName ? ` (${baseScheduleName})` : '' }}
            </button>
          </div>
          <div class="select-with-btn-row">
            <select
              id="roomSelect"
              v-model="schedule.selectedRoom"
              :disabled="schedule.isAggregatorLoading && availableRooms.length === 0"
              @change="onRoomSelectChange"
            >
              <option v-if="schedule.isAggregatorLoading && availableRooms.length === 0" value="" disabled>
                Chargement des salles...
              </option>
              <option v-else value="">
                {{ availableRooms.length ? 'Sélectionnez une salle...' : 'Aucune salle trouvée' }}
              </option>
              <option v-for="r in availableRooms" :key="r" :value="r">{{ r }}</option>
            </select>
            <button
              type="button"
              class="btn btn-primary btn-load-action"
              :disabled="!unref(schedule.selectedRoom) || unref(schedule.isLoading)"
              title="Charger l'emploi du temps de cette salle"
              aria-label="Charger l'emploi du temps de cette salle"
              @click="onRoomSelectChange"
            >
              <i class="pi" :class="schedule.isLoading ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>
              <span class="btn-load-text">Charger</span>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Actions toolbar -->
    <div v-if="showActions" class="actions-row">
      <button
        v-if="isTeacherMode || isRoomMode"
        type="button"
        class="btn btn-outline btn-return-base"
        title="Revenir à mon emploi du temps habituel"
        @click="schedule.returnToBaseSchedule ? schedule.returnToBaseSchedule() : onSelectStudentTab()"
      >
        <i class="pi pi-arrow-left" style="margin-right: 0.35rem;" aria-hidden="true"></i>
        <span class="btn-text">Revenir à mon planning</span>
      </button>

      <button
        type="button"
        class="btn btn-outline btn-pin"
        :class="{ 'btn-pinned': isCurrentPinned }"
        :aria-pressed="isCurrentPinned"
        :title="isCurrentPinned ? 'Retirer des favoris' : 'Épingler dans la barre des favoris'"
        :aria-label="isCurrentPinned ? 'Retirer des favoris' : 'Épingler dans la barre des favoris'"
        @click="onTogglePin"
      >
        <i :class="isCurrentPinned ? 'pi pi-star-fill text-amber-500' : 'pi pi-star'" style="margin-right: 0.35rem;" aria-hidden="true"></i>
        <span class="btn-text">{{ isCurrentPinned ? 'Épinglé' : 'Épingler' }}</span>
      </button>

      <button
        type="button"
        class="btn btn-outline btn-empty-rooms"
        title="Rechercher des salles libres sur un créneau"
        aria-label="Rechercher des salles libres sur un créneau"
        @click="emit('openEmptyRooms')"
      >
        <i class="pi pi-building" style="margin-right: 0.35rem;" aria-hidden="true"></i>
        <span class="btn-text">Salles vides</span>
      </button>

      <button
        type="button"
        class="btn btn-outline btn-ru-menu"
        :class="{ 'btn-ru-active': schedule.showRuMenu }"
        :aria-pressed="Boolean(unref(schedule.showRuMenu))"
        :title="schedule.showRuMenu ? 'Masquer le menu du restaurant universitaire (RU Briff\'O)' : 'Afficher le menu du restaurant universitaire (RU Briff\'O)'"
        :aria-label="schedule.showRuMenu ? 'Masquer le menu du RU' : 'Afficher le menu du RU'"
        @click="schedule.toggleRuMenu?.()"
      >
        <span class="ru-icon" style="margin-right: 0.35rem; font-size: 0.9rem;" aria-hidden="true">🍽️</span>
        <span class="btn-text">Menu RU</span>
      </button>

      <a
        v-if="canCopyIcsLink"
        :href="currentIcsUrl"
        download
        class="btn btn-outline btn-download-ics"
        title="Télécharger le fichier calendrier .ics brut"
      >
        <i class="pi pi-download" style="margin-right: 0.35rem;" aria-hidden="true"></i> Télécharger
      </a>

      <button
        v-if="canCopyIcsLink"
        type="button"
        class="btn btn-outline btn-copy-link"
        title="Copier le lien direct du calendrier (.ics) pour s'abonner (Google Agenda, Apple, Outlook...)"
        aria-label="Copier le lien du calendrier"
        @click="copyIcsLink"
      >
        <i class="pi pi-link" aria-hidden="true"></i>
        <span class="btn-text" style="margin-left: 0.35rem;">Copier le lien</span>
      </button>

      <a
        v-if="canCopyIcsLink && webcalUrl"
        :href="webcalUrl"
        class="btn btn-outline btn-subscribe"
        title="S'abonner dans votre application d'agenda (Apple Calendar, Outlook, Thunderbird) : le planning se mettra à jour automatiquement"
        aria-label="S'abonner dans mon agenda"
      >
        <i class="pi pi-calendar-plus" aria-hidden="true"></i>
        <span class="btn-text" style="margin-left: 0.35rem;">S'abonner</span>
      </a>

      <button
        type="button"
        class="btn btn-outline btn-share"
        title="Copier le lien partageable"
        aria-label="Copier le lien partageable"
        @click="copyShareLink"
      >
        <i class="pi pi-share-alt" aria-hidden="true"></i>
        <span class="btn-text" style="margin-left: 0.35rem;">Partager</span>
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

/* Mode Tabs Segmented Control */
.mode-tabs {
  display: flex;
  background: var(--bg);
  padding: 0.3rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  gap: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}

.mode-tabs::-webkit-scrollbar {
  display: none;
}

.mode-tab-btn {
  flex: 1;
  min-width: fit-content;
  padding: 0.5rem 0.85rem;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

@media (hover: hover) and (pointer: fine) {
  .mode-tab-btn:hover {
    color: var(--text);
  }
}

.mode-tab-btn.active {
  background: var(--card);
  color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

:global(.dark-mode) .mode-tab-btn.active {
  background: #334155;
  color: #60a5fa;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.quick-search-row {
  position: relative;
  width: 100%;
}

.search-box {
  position: relative;
}

.search-kbd {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-family: inherit;
  font-size: 0.72rem;
  color: var(--muted);
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 0.65rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem; /* 16px to prevent iOS Safari auto-zoom */
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

.search-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.search-item:hover,
.search-item.active {
  background: var(--bg);
}

.search-item.active {
  box-shadow: inset 3px 0 0 var(--accent);
}

.search-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: var(--muted);
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

.select-with-btn-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.select-with-btn-row select {
  flex: 1;
  min-width: 0;
}

.btn-load-action {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  height: 38px;
  flex-shrink: 0;
  border-radius: 8px;
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

/* Personal Schedule Dedicated Card Styles */
.personal-status-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 10px;
  padding: 0.85rem 1rem;
}

.personal-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.personal-status-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.personal-badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: #3b82f6;
  color: #fff;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.personal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
}

.personal-meta-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 0.8rem;
  color: var(--muted);
  background: var(--bg);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.personal-actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Unconfigured Personal Schedule Card */
.personal-unconfigured-card {
  background: rgba(59, 130, 246, 0.05);
  border: 1px dashed rgba(59, 130, 246, 0.4);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.unconfigured-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: space-between;
}

.unconfigured-icon {
  font-size: 2rem;
  line-height: 1;
}

.unconfigured-info {
  flex: 1;
  min-width: 240px;
}

.unconfigured-title {
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
}

.unconfigured-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.4;
}

.btn-configure {
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.82rem;
}

.btn-danger-soft {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-danger-soft:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.btn-ru-menu {
  transition: all 0.2s ease;
}

.btn-ru-menu.btn-ru-active {
  border-color: #ea580c;
  color: #ea580c;
  background-color: rgba(234, 88, 12, 0.08);
}

:root[class~="dark"] .btn-ru-menu.btn-ru-active {
  border-color: #fb923c;
  color: #fdba74;
  background-color: rgba(251, 146, 60, 0.14);
}

@media (max-width: 640px) {
  /* Full-width blocks (teacher/room pickers, personal cards) span the whole 2-column grid. */
  .control-group.span-3,
  .personal-status-card.span-3,
  .personal-unconfigured-card.span-3 {
    grid-column: 1 / -1;
  }

  /* The toolbar already has a full-width "Revenir à mon planning" button. */
  .control-header-row .btn-return-link {
    display: none;
  }
  .personal-status-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .unconfigured-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.control-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.control-header-row label {
  margin-bottom: 0 !important;
}

.btn-return-link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm, 6px);
  transition: all 0.2s ease;
}

.btn-return-link:hover {
  background-color: var(--accent-light, rgba(37, 99, 235, 0.1));
  text-decoration: underline;
}

.btn-return-base {
  color: var(--accent) !important;
  border-color: var(--accent) !important;
  font-weight: 600 !important;
}

.btn-return-base:hover {
  background-color: var(--accent) !important;
  color: #fff !important;
}

.tab-label-mobile {
  display: none;
}

.tab-icon {
  margin-right: 0.35rem;
}

@media (max-width: 640px) {
  .tab-label-desktop {
    display: none;
  }

  .tab-label-mobile {
    display: inline;
  }

  /* All four modes stay visible: icon above a short label, no hidden scroll. */
  .mode-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    overflow: visible;
    gap: 0.25rem;
  }

  .mode-tab-btn {
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.45rem 0.25rem;
    font-size: 0.75rem;
  }

  .tab-icon {
    margin-right: 0;
    font-size: 1rem;
  }

  .search-kbd {
    display: none;
  }

  .controls-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.5rem !important;
  }

  .control-group {
    min-width: 0 !important;
  }

  .control-group select {
    width: 100% !important;
    min-width: 0 !important;
  }

  .control-header-row {
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .select-with-btn-row {
    gap: 0.35rem !important;
  }

  /* The select already loads on change: keep the button as a compact icon. */
  .btn-load-action {
    width: 38px;
    padding: 0 !important;
  }

  .btn-load-text {
    display: none;
  }

  /* Toolbar: labelled actions first (full-width row), then 44px icon buttons. */
  .actions-row {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 0.4rem !important;
  }

  .actions-row > .btn {
    min-height: 44px;
  }

  .btn-return-base {
    order: -2;
    flex: 1 1 100% !important;
  }

  .btn-empty-rooms,
  .btn-ru-menu {
    order: -1;
    flex: 1 1 calc(50% - 0.2rem) !important;
    min-width: 0 !important;
    justify-content: center !important;
    padding: 0.5rem !important;
  }

  .btn-empty-rooms .btn-text,
  .btn-ru-menu .btn-text {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .btn-download-ics {
    display: none !important;
  }

  .btn-pin,
  .btn-copy-link,
  .btn-subscribe,
  .btn-share {
    flex: 1 1 0 !important;
    min-width: 44px;
    padding: 0.5rem !important;
  }

  .btn-pin .btn-text,
  .btn-copy-link .btn-text,
  .btn-subscribe .btn-text,
  .btn-share .btn-text {
    display: none !important;
  }

  .btn-pin i,
  .btn-copy-link i,
  .btn-subscribe i,
  .btn-share i {
    margin: 0 !important;
  }
}
</style>
