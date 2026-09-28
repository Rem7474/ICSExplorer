<script setup>
import { computed, inject } from "vue";
import { mdiChevronRight } from "@mdi/js";
import { formatTimeOnly } from "../utils/dates.js";
import { isCercleEvent } from "../utils/colors.js";
import WeekStats from "../components/WeekStats.vue";
import PlanningGrid from "../components/planning/PlanningGrid.vue";
import ScheduleSkeleton from "../components/skeletons/ScheduleSkeleton.vue";

// Planning screen: fills the viewport; only the grid scrolls (natively).
const schedule = inject("schedule");
const openPersonalSchedule = inject("openPersonalSchedule");

const nextLabel = computed(() => {
  const c = schedule.nextCourse;
  if (!c) return "";
  const start = new Date(c.start);
  const day = start.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return [c.summary, `${day} ${formatTimeOnly(start)}`, c.location].filter(Boolean).join(" · ");
});
const nextIsCercle = computed(() => schedule.nextCourse && isCercleEvent(schedule.nextCourse));

const weekStart = computed({
  get: () => schedule.currentWeekStart,
  set: (value) => (schedule.currentWeekStart = value),
});
</script>

<template>
  <div class="planning-screen container">
    <div v-if="schedule.statusMessage" class="status-banner" role="status">
      <span class="status-message-text">{{ schedule.statusMessage }}</span>
      <button v-if="schedule.statusAction === 'configure-personal'" type="button" class="btn btn-primary btn-sm" @click="openPersonalSchedule">
        ✨ Configurer mon planning ADE
      </button>
    </div>

    <div v-if="!schedule.isLoading && schedule.availableFiles.length === 0 && !schedule.events.length" class="welcome-card card">
      <h2>👋 Bienvenue sur ICSExplorer</h2>
      <p>Les emplois du temps de l'école ne sont pas encore disponibles sur ce serveur.</p>
      <p class="welcome-help">
        En attendant, vous pouvez afficher votre propre planning ADE.
        <em>Administrateur :</em> renseignez <code>AGALAN_LOGIN</code> / <code>AGALAN_PASSWORD</code> pour activer la synchronisation automatique.
      </p>
      <button class="btn btn-primary" type="button" @click="openPersonalSchedule">✨ Configurer mon planning ADE</button>
    </div>

    <template v-else>
      <button v-if="schedule.nextCourse" type="button" class="next-banner" @click="schedule.openEventModal(schedule.nextCourse)">
        <span class="next-kicker">{{ nextIsCercle ? "Prochain événement" : "Prochain cours" }}</span>
        <span class="next-text">{{ nextLabel }}</span>
        <v-icon :icon="mdiChevronRight" size="20" />
      </button>

      <WeekStats
        compact
        :events="schedule.weekEvents"
        :disabled-subjects="schedule.disabledSubjects"
        @filter="schedule.toggleSubjectFilter"
        @reset="schedule.resetSubjectFilters"
      />

      <ScheduleSkeleton v-if="schedule.isLoading && schedule.events.length === 0" />
      <PlanningGrid
        v-else
        id="planning"
        v-model:week-start="weekStart"
        class="grid-fill"
        :events="schedule.displayedEvents"
        @event-click="schedule.openEventModal"
      />
    </template>
  </div>
</template>

<style scoped>
/* Fill the space between the top bar and the tab bar (or the screen bottom). */
.planning-screen {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: calc(100dvh - var(--v-layout-top, 64px) - var(--nav-h));
  padding-top: 8px;
  padding-bottom: 8px;
}

@media (min-width: 960px) {
  .planning-screen {
    height: calc(100dvh - var(--v-layout-top, 64px));
  }
}

.grid-fill {
  flex: 1;
  min-height: 0;
}

.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  font-size: 0.88rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
}

.status-message-text {
  flex: 1;
}

.next-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px 8px 12px;
  border: 0;
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.08);
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.next-kicker {
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #1e3a8a;
}

.next-text {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style>
.v-theme--dark .planning-screen .next-banner,
.v-theme--dark .planning-screen .status-banner {
  background: rgba(var(--v-theme-primary), 0.12);
}

.v-theme--dark .planning-screen .next-kicker {
  color: rgb(var(--v-theme-primary));
}
</style>
