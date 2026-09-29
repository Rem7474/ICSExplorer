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
import InstallSheet from "./components/InstallSheet.vue";
import { useInstallPrompt } from "./composables/useInstallPrompt.js";
import { readString, write } from "./stores/storage.js";

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

// Returning users are offered the installation once (then every 30 days).
const installPrompt = useInstallPrompt();
let installTimer = null;

// After an update, say so (the new version replaced the old one silently).
const LAST_VERSION_KEY = "edtLastVersion";
const announceUpdate = () => {
  const version = import.meta.env.VITE_APP_VERSION;
  if (!version) return;
  const previous = readString(LAST_VERSION_KEY);
  if (previous && previous !== version) showToast(`ICSExplorer est à jour (${version})`, "success", 4000);
  write(LAST_VERSION_KEY, version);
};

onMounted(() => {
  schedule.init();
  announceUpdate();
  installPrompt.recordVisit();
  installTimer = setTimeout(() => installPrompt.shouldSuggest() && installPrompt.openSheet(), 15000);
  window.addEventListener("pwa-update-available", handlePwaUpdate);
  window.addEventListener("keydown", handleShortcut);
});

onUnmounted(() => {
  clearTimeout(installTimer);
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
      <!-- Tabs cross-fade like native apps; changing schedule on Planning doesn't re-animate. -->
      <router-view v-slot="{ Component, route }">
        <transition name="screen" mode="out-in">
          <component :is="Component" :key="route.meta.tab" />
        </transition>
      </router-view>
    </v-main>

    <EventSheet
      :event="schedule.activeModalEvent"
      @close="schedule.closeEventModal"
      @select-teacher="schedule.loadTeacherSchedule"
      @select-room="schedule.loadRoomSchedule"
    />

    <PersonalScheduleFlow v-if="isPersonalFlowOpen" @close="isPersonalFlowOpen = false" />

    <InstallSheet />
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
  padding-top: var(--top-h) !important;
  padding-bottom: var(--nav-h) !important;
}

.screen-enter-active,
.screen-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.screen-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.screen-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .screen-enter-active,
  .screen-leave-active {
    transition: none;
  }
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
