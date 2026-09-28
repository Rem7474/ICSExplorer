<script setup>
import { computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  mdiCalendarToday, mdiCalendarTodayOutline, mdiMagnify, mdiDoorOpen, mdiDoor,
  mdiDotsHorizontalCircle, mdiDotsHorizontalCircleOutline,
} from "@mdi/js";
import { PLANNING_PATH } from "../../router/index.js";

// Main navigation: frosted tab bar at the bottom on phones (iOS tab bar look,
// Material 3 pill indicator), navigation rail on the left on wide screens.
const schedule = inject("schedule");
const route = useRoute();
const router = useRouter();

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
</script>

<template>
  <nav class="app-nav" aria-label="Navigation principale">
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
    top: var(--v-layout-top, 64px);
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
    gap: 4px;
  }

  .nav-indicator {
    width: 56px;
    height: 32px;
  }

  .nav-label {
    font-size: 0.75rem;
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
</style>
