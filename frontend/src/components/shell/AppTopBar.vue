<script setup>
import { computed, inject } from "vue";
import { useRoute } from "vue-router";
import { useDisplay } from "vuetify";
import { mdiArrowLeft, mdiStar, mdiStarOutline } from "@mdi/js";
import { useFavorites } from "../../composables/useFavorites.js";
import { useToast } from "../../composables/useToast.js";
import { freshnessBadge } from "../../utils/freshness.js";

// Material 3 top app bar in the brand gradient: title of the current screen
// (the displayed schedule on Planning), data freshness, favorite toggle and a
// back arrow when browsing a teacher/room schedule.
const schedule = inject("schedule");
const route = useRoute();
const { mdAndUp, smAndDown } = useDisplay();
const brandIcon = "/apple-touch-icon.png";
const { isFavorited, toggleFavorite } = useFavorites();
const { showToast } = useToast();

const SCREEN_TITLES = { search: "Rechercher", rooms: "Salles libres", more: "Plus" };

const onPlanning = computed(() => route.meta.tab === "planning");
const title = computed(() => (onPlanning.value ? schedule.scheduleLabel || "ICSExplorer" : SCREEN_TITLES[route.meta.tab] || "ICSExplorer"));

const badge = computed(() => freshnessBadge(schedule.serverHealth, schedule.isOnline, schedule.currentTime));
// Phones: "À jour · 33 min" (the full wording stays in the tooltip).
const badgeText = computed(() => (smAndDown.value ? badge.value.text.replace(" il y a ", " ") : badge.value.text));

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
  <v-app-bar class="top-bar" flat :height="mdAndUp ? 64 : 52">
    <!-- Large screens: brand above the navigation drawer. -->
    <div class="top-bar-brand" aria-hidden="true">
      <img :src="brandIcon" alt="" width="32" height="32" />
      <span>ICSExplorer</span>
    </div>
    <template v-if="canGoBack" #prepend>
      <v-btn :icon="mdiArrowLeft" color="white" aria-label="Revenir à mon planning" @click="schedule.returnToBaseSchedule()" />
    </template>

    <div class="top-bar-titles" :class="{ 'with-back': canGoBack }">
      <!-- rtl + ltr inner: when too long, the start is cut ("…App-S9-SIS"), not the end. -->
      <h1 class="top-bar-title"><span dir="ltr">{{ title }}</span></h1>
      <span class="top-bar-status" :class="`status-${badge.level}`" :title="badge.title || undefined" role="status">
        <span class="status-dot" aria-hidden="true" />{{ badgeText }}
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
  direction: rtl;
  text-align: left;
}

.top-bar-title > span {
  unicode-bidi: isolate;
}

.top-bar-brand {
  display: none;
}

/* Desktop: taller bar, bigger title. */
@media (min-width: 960px) {
  .top-bar.v-app-bar {
    height: 64px !important;
  }

  .top-bar-titles {
    gap: 14px;
    padding-left: 24px;
  }

  .top-bar-title {
    font-size: 1.4rem;
  }

  .top-bar-status {
    margin-left: auto;
    margin-right: 8px;
    padding: 5px 12px;
    font-size: 0.85rem;
  }
}

@media (min-width: 1280px) {
  .top-bar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 var(--rail-w);
    padding-left: 20px;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .top-bar-brand img {
    border-radius: 8px;
  }
}

.top-bar-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
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
/* Collapsed drawer: the brand shrinks to the icon above the rail. */
@media (min-width: 1280px) {
  .nav-collapsed .top-bar-brand {
    padding-left: 32px;
  }

  .nav-collapsed .top-bar-brand span {
    display: none;
  }
}

/* Dark theme overrides (unscoped: :global() in scoped styles did not apply). */
.v-theme--dark .top-bar.v-app-bar {
  background: linear-gradient(135deg, #0b1740 0%, #1e3a8a 100%) !important;
}
</style>
