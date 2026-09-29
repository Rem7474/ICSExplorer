<script setup>
import { computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  mdiCalendarToday, mdiCalendarTodayOutline, mdiMagnify, mdiDoorOpen, mdiDoor,
  mdiDotsHorizontalCircle, mdiDotsHorizontalCircleOutline, mdiSchool, mdiAccountOutline, mdiAccountSchoolOutline,
  mdiChevronDoubleLeft, mdiChevronDoubleRight,
} from "@mdi/js";
import { PLANNING_PATH } from "../../router/index.js";
import { useFavorites } from "../../composables/useFavorites.js";
import { useNavCollapsed } from "../../composables/useNavCollapsed.js";

// Main navigation: frosted tab bar at the bottom on phones (iOS tab bar look,
// Material 3 pill indicator), navigation rail on the left on tablets and
// small laptops, navigation drawer (labels + favorites) on large screens.
const schedule = inject("schedule");
const route = useRoute();
const router = useRouter();

const { collapsed, toggle: toggleCollapsed } = useNavCollapsed();

const items = computed(() => [
  // The Planning link keeps the displayed schedule in the URL (shareable).
  { tab: "planning", label: "Planning", icon: mdiCalendarTodayOutline, activeIcon: mdiCalendarToday, to: { path: PLANNING_PATH, query: schedule.scheduleQuery } },
  { tab: "search", label: "Rechercher", icon: mdiMagnify, activeIcon: mdiMagnify, to: { name: "search" } },
  { tab: "rooms", label: "Salles libres", icon: mdiDoor, activeIcon: mdiDoorOpen, to: { name: "rooms" } },
  { tab: "more", label: "Plus", icon: mdiDotsHorizontalCircleOutline, activeIcon: mdiDotsHorizontalCircle, to: { name: "more" } },
]);

const go = (item) => {
  if (route.meta.tab !== item.tab) router.push(item.to);
};

// Drawer only: favorites one click away.
const { favorites } = useFavorites();
const FAV_ICONS = { personal: mdiSchool, teacher: mdiAccountOutline, room: mdiDoorOpen, student: mdiAccountSchoolOutline };
const favKey = computed(() => {
  const s = schedule;
  if (s.selectedMode === "personal") return "personal_edt";
  if (s.selectedMode === "teacher") return `teacher_${s.selectedTeacher}`;
  if (s.selectedMode === "room") return `room_${s.selectedRoom}`;
  return s.selectedFile ? `file_${s.selectedFile}` : "";
});
const openFavorite = (fav) => {
  if (fav.mode === "personal") schedule.setMode("personal").then(() => router.push({ path: PLANNING_PATH, query: schedule.scheduleQuery }));
  else if (fav.mode === "teacher") schedule.loadTeacherSchedule(fav.teacher);
  else if (fav.mode === "room") schedule.loadRoomSchedule(fav.room);
  else schedule.loadSchedule(fav.file);
};
</script>

<template>
  <nav class="app-nav" :class="{ collapsed }" aria-label="Navigation principale">
    <button
      v-for="item in items"
      :key="item.tab"
      type="button"
      class="nav-item"
      :class="{ active: route.meta.tab === item.tab }"
      :aria-current="route.meta.tab === item.tab ? 'page' : undefined"
      @click="go(item)"
    >
      <span class="nav-indicator">
        <v-icon :icon="route.meta.tab === item.tab ? item.activeIcon : item.icon" size="24" />
      </span>
      <span class="nav-label">{{ item.label }}</span>
    </button>

    <section v-if="favorites.length" class="nav-favorites" aria-label="Favoris">
      <h2 class="nav-section-title">Favoris</h2>
      <button
        v-for="fav in favorites"
        :key="fav.key"
        type="button"
        class="nav-fav"
        :class="{ current: route.meta.tab === 'planning' && fav.key === favKey }"
        :title="fav.label"
        @click="openFavorite(fav)"
      >
        <v-icon :icon="FAV_ICONS[fav.mode] || mdiAccountSchoolOutline" size="20" />
        <span class="nav-fav-label">{{ fav.label }}</span>
      </button>
    </section>

    <button
      type="button"
      class="nav-collapse"
      :aria-label="collapsed ? 'Développer le menu' : 'Réduire le menu'"
      :aria-expanded="!collapsed"
      :title="collapsed ? 'Développer le menu' : 'Réduire le menu'"
      @click="toggleCollapsed"
    >
      <v-icon :icon="collapsed ? mdiChevronDoubleRight : mdiChevronDoubleLeft" size="22" />
      <span class="nav-collapse-label">Réduire</span>
    </button>
  </nav>
</template>

<style scoped>
/* Phone: bottom tab bar */
.app-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1004;
  display: flex;
  height: var(--nav-h);
  padding: 6px 4px env(safe-area-inset-bottom);
  background: rgba(var(--v-theme-surface), 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid rgba(var(--v-theme-on-surface), 0.12);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: 0;
  background: none;
  font: inherit;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.nav-indicator {
  display: grid;
  place-items: center;
  width: 60px;
  height: 30px;
  border-radius: 999px;
  transition: background-color 0.2s ease;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.nav-item.active {
  color: #1e3a8a;
}

.nav-item.active .nav-indicator {
  background: rgba(37, 99, 235, 0.14);
}

.nav-item.active .nav-label {
  font-weight: 700;
}


@media (hover: hover) and (pointer: fine) {
  .nav-item:hover .nav-indicator {
    background: rgba(var(--v-theme-on-surface), 0.06);
  }
}

/* Wide screens: navigation rail on the left, below the top bar */
@media (min-width: 960px) {
  .app-nav {
    top: var(--top-h);
    right: auto;
    width: var(--rail-w);
    height: auto;
    flex-direction: column;
    justify-content: flex-start;
    gap: 12px;
    padding: 16px 0;
    border-top: 0;
    border-right: 0.5px solid rgba(var(--v-theme-on-surface), 0.12);
    background: rgb(var(--v-theme-surface));
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .nav-item {
    flex: 0 0 auto;
    gap: 5px;
  }

  .nav-indicator {
    width: 60px;
    height: 34px;
  }

  .nav-label {
    font-size: 0.8rem;
  }
}

.nav-favorites,
.nav-collapse {
  display: none;
}

/* Large screens: navigation drawer with labels beside the icons, and favorites. */
@media (min-width: 1280px) {
  .app-nav:not(.collapsed) {
    gap: 4px;
    padding: 16px 12px;
    overflow-y: auto;
  }

  .app-nav:not(.collapsed) .nav-item {
    flex-direction: row;
    gap: 14px;
    height: 52px;
    padding: 0 16px 0 8px;
    border-radius: 999px;
    color: rgb(var(--v-theme-on-surface-variant));
  }

  .app-nav:not(.collapsed) .nav-indicator {
    width: 40px;
    height: 40px;
    background: none !important;
  }

  .app-nav:not(.collapsed) .nav-label {
    font-size: 0.98rem;
    font-weight: 600;
  }

  .app-nav:not(.collapsed) .nav-item.active {
    background: rgba(37, 99, 235, 0.12);
  }

  .app-nav:not(.collapsed) .nav-favorites {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  }

  .app-nav:not(.collapsed) .nav-section-title {
    margin: 0 16px 8px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgb(var(--v-theme-on-surface-variant));
  }

  .app-nav:not(.collapsed) .nav-fav {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 44px;
    padding: 0 16px 0 18px;
    border: 0;
    border-radius: 999px;
    background: none;
    font: inherit;
    font-size: 0.92rem;
    text-align: left;
    color: rgb(var(--v-theme-on-surface));
    cursor: pointer;
  }

  .app-nav:not(.collapsed) .nav-fav:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
  }

  .app-nav:not(.collapsed) .nav-fav.current {
    font-weight: 700;
    color: #1e3a8a;
  }

  .app-nav:not(.collapsed) .nav-fav-label {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-collapse {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: auto;
    height: 44px;
    padding: 0 16px 0 10px;
    border: 0;
    border-radius: 999px;
    background: none;
    font: inherit;
    font-size: 0.92rem;
    color: rgb(var(--v-theme-on-surface-variant));
    cursor: pointer;
  }

  .nav-collapse:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
  }

  .app-nav.collapsed .nav-collapse {
    justify-content: center;
    padding: 0;
  }

  .app-nav.collapsed .nav-collapse-label {
    display: none;
  }
}
</style>

<style>
/* Dark theme overrides (unscoped: :global() in scoped styles did not apply). */
.v-theme--dark .nav-item.active {
  color: rgb(var(--v-theme-primary));
}

.v-theme--dark .nav-item.active .nav-indicator {
  background: rgba(var(--v-theme-primary), 0.18);
}

@media (min-width: 1280px) {
  .v-theme--dark .app-nav:not(.collapsed) .nav-item.active {
    background: rgba(var(--v-theme-primary), 0.16);
  }

  .v-theme--dark .app-nav:not(.collapsed) .nav-fav.current {
    color: rgb(var(--v-theme-primary));
  }
}
</style>
