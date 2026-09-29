<script setup>
import { computed, inject } from "vue";
import { useRoute } from "vue-router";
import { mdiArrowLeft, mdiStar, mdiStarOutline } from "@mdi/js";
import { useFavorites } from "../../composables/useFavorites.js";
import { useToast } from "../../composables/useToast.js";
import { freshnessBadge } from "../../utils/freshness.js";

// Material 3 top app bar in the brand gradient: title of the current screen
// (the displayed schedule on Planning), data freshness, favorite toggle and a
// back arrow when browsing a teacher/room schedule.
const schedule = inject("schedule");
const route = useRoute();
const { isFavorited, toggleFavorite } = useFavorites();
const { showToast } = useToast();

const SCREEN_TITLES = { search: "Rechercher", rooms: "Salles libres", more: "Plus" };

const onPlanning = computed(() => route.meta.tab === "planning");
const title = computed(() => (onPlanning.value ? schedule.scheduleLabel || "ICSExplorer" : SCREEN_TITLES[route.meta.tab] || "ICSExplorer"));

const badge = computed(() => freshnessBadge(schedule.serverHealth, schedule.isOnline, schedule.currentTime));

// Browsing someone else's schedule (teacher/room): offer a way back to "mine".
const canGoBack = computed(() => onPlanning.value && (schedule.selectedMode === "teacher" || schedule.selectedMode === "room"));

const favoriteItem = computed(() => {
  const s = schedule;
  if (s.selectedMode === "personal") return { key: "personal_edt", mode: "personal", label: s.personalScheduleInfo?.name || "Mon Planning ADE" };
  if (s.selectedMode === "teacher" && s.selectedTeacher) return { key: `teacher_${s.selectedTeacher}`, mode: "teacher", teacher: s.selectedTeacher, label: `Prof. ${s.selectedTeacher}` };
  if (s.selectedMode === "room" && s.selectedRoom) return { key: `room_${s.selectedRoom}`, mode: "room", room: s.selectedRoom, label: `Salle ${s.selectedRoom}` };
  if (s.selectedFile) return { key: `file_${s.selectedFile}`, mode: "student", file: s.selectedFile, label: s.selectedFile.replace(/\.ics$/i, "") };
  return null;
});
const isPinned = computed(() => Boolean(favoriteItem.value && isFavorited(favoriteItem.value)));

const onTogglePin = () => {
  if (!favoriteItem.value) return;
  toggleFavorite(favoriteItem.value);
  showToast(isPinned.value ? "Ajouté aux favoris" : "Retiré des favoris", "info");
};
</script>

<template>
  <v-app-bar class="top-bar" flat height="52">
    <template v-if="canGoBack" #prepend>
      <v-btn :icon="mdiArrowLeft" color="white" aria-label="Revenir à mon planning" @click="schedule.returnToBaseSchedule()" />
    </template>

    <div class="top-bar-titles" :class="{ 'with-back': canGoBack }">
      <h1 class="top-bar-title">{{ title }}</h1>
      <span class="top-bar-status" :class="`status-${badge.level}`" :title="badge.title || undefined" role="status">
        <span class="status-dot" aria-hidden="true" />{{ badge.text }}
      </span>
    </div>

    <template v-if="onPlanning && favoriteItem" #append>
      <v-btn
        :icon="isPinned ? mdiStar : mdiStarOutline"
        color="white"
        :aria-label="isPinned ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        :aria-pressed="isPinned"
        @click="onTogglePin"
      />
    </template>
  </v-app-bar>
</template>

<style scoped>
.top-bar.v-app-bar {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
  color: #fff !important;
  padding-top: env(safe-area-inset-top);
  height: calc(52px + env(safe-area-inset-top)) !important;
}


/* Name and status on one line to save height. */
.top-bar-titles {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  padding-left: 16px;
}

.top-bar-titles.with-back {
  padding-left: 0;
}

.top-bar-title {
  margin: 0;
  min-width: 0;
  flex: 0 1 auto;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-bar-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 55%;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  flex: 0 0 auto;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34d399;
}

.status-warning .status-dot {
  background: #fbbf24;
}

.status-offline .status-dot {
  background: #cbd5e1;
}
</style>

<style>
/* Dark theme overrides (unscoped: :global() in scoped styles did not apply). */
.v-theme--dark .top-bar.v-app-bar {
  background: linear-gradient(135deg, #0b1740 0%, #1e3a8a 100%) !important;
}
</style>
