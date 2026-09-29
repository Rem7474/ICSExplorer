<script setup>
import { ref, reactive, provide, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useTheme as useVuetifyTheme } from "vuetify";
import { useSchedule } from "./composables/useSchedule.js";
import { useTheme } from "./composables/useTheme.js";
import { useToast } from "./composables/useToast.js";
import { isIOS } from "./plugins/vuetify.js";

import AppTopBar from "./components/shell/AppTopBar.vue";
import AppNav from "./components/shell/AppNav.vue";
import EventSheet from "./components/planning/EventSheet.vue";
import PersonalScheduleFlow from "./components/personal/PersonalScheduleFlow.vue";
import ToastContainer from "./components/ToastContainer.vue";

// App shell: top app bar, the current screen (router view), main navigation
// (bottom tab bar on phones, rail on wide screens) and global dialogs.
const schedule = reactive(useSchedule());
const { showToast } = useToast();
const isPersonalFlowOpen = ref(false);
const openPersonalSchedule = () => (isPersonalFlowOpen.value = true);

provide("schedule", schedule);
provide("openPersonalSchedule", openPersonalSchedule);

// Keep Vuetify's theme in sync with the app's light/dark preference.
const { isDark } = useTheme();
const vuetifyTheme = useVuetifyTheme();
watch(isDark, (dark) => vuetifyTheme.change(dark ? "dark" : "light"), { immediate: true });

const handlePwaUpdate = (e) => {
  showToast("Une nouvelle version de l'application est disponible.", "info", 0, {
    label: "Mettre à jour",
    onClick: () => (typeof e.detail?.update === "function" ? e.detail.update() : window.location.reload()),
  });
};

// Ctrl/⌘+K: jump to the search field from anywhere.
const router = useRouter();
const handleShortcut = async (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
  e.preventDefault();
  await router.push({ name: "search" });
  await nextTick();
  document.getElementById("quickSearchInput")?.focus();
};

onMounted(() => {
  schedule.init();
  window.addEventListener("pwa-update-available", handlePwaUpdate);
  window.addEventListener("keydown", handleShortcut);
});

onUnmounted(() => {
  schedule.stopHealthPolling?.();
  window.removeEventListener("pwa-update-available", handlePwaUpdate);
  window.removeEventListener("keydown", handleShortcut);
});
</script>

<template>
  <v-app :class="{ 'is-ios': isIOS }">
    <a class="skip-link" href="#main-content">Aller au contenu</a>

    <AppTopBar />
    <AppNav />

    <v-main id="main-content" class="app-main" tabindex="-1">
      <router-view />
    </v-main>

    <EventSheet
      :event="schedule.activeModalEvent"
      @close="schedule.closeEventModal"
      @select-teacher="schedule.loadTeacherSchedule"
      @select-room="schedule.loadRoomSchedule"
    />

    <PersonalScheduleFlow v-if="isPersonalFlowOpen" @close="isPersonalFlowOpen = false" />

    <ToastContainer />
  </v-app>
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 0.75rem;
  top: -3rem;
  z-index: 2000;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.15s ease;
}

.skip-link:focus {
  top: 0.75rem;
}

/* Room for the bottom tab bar (phones) or the navigation rail (wide screens). */
.app-main {
  padding-bottom: var(--nav-h) !important;
}

.app-main:focus {
  outline: none;
}

@media (min-width: 960px) {
  .app-main {
    padding-bottom: 0 !important;
    padding-left: var(--rail-w) !important;
  }
}
</style>
