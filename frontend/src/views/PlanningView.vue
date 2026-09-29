<script setup>
import { computed, inject, ref } from "vue";
import { mdiFilterVariant } from "@mdi/js";
import WeekStats from "../components/WeekStats.vue";
import PlanningGrid from "../components/planning/PlanningGrid.vue";
import ScheduleSkeleton from "../components/skeletons/ScheduleSkeleton.vue";
import PullIndicator from "../components/PullIndicator.vue";
import { usePullToRefresh } from "../composables/usePullToRefresh.js";
import { vSwipeDismiss } from "../composables/swipeDismiss.js";
import { useScheduleStore } from "../stores/schedule.js";

// Planning screen: fills the viewport; only the grid scrolls (natively).
const schedule = inject("schedule");
const openPersonalSchedule = inject("openPersonalSchedule");

// Phones: subject stats/filters live in a sheet opened from the grid toolbar,
// to leave the height to the planning.
const filtersOpen = ref(false);

// Pull down (when the day is scrolled to its top) to fetch the schedule again.
const screenRef = ref(null);
const store = useScheduleStore();
const { distance: pullDistance, refreshing } = usePullToRefresh(screenRef, {
  onRefresh: () => store.refresh(),
  canStart: (e) => {
    const scroller = e.target.closest?.(".grid-scroller");
    return !scroller || scroller.scrollTop <= 0;
  },
});

const weekStart = computed({
  get: () => schedule.currentWeekStart,
  set: (value) => (schedule.currentWeekStart = value),
});
</script>

<template>
  <div ref="screenRef" class="planning-screen container">
    <PullIndicator :distance="pullDistance" :refreshing="refreshing" />
    <div v-if="schedule.statusMessage" class="status-banner" role="status">
      <span class="status-message-text">{{ schedule.statusMessage }}</span>
      <v-btn v-if="schedule.statusAction === 'configure-personal'" color="primary" variant="flat" size="small" @click="openPersonalSchedule">
        Configurer mon planning ADE
      </v-btn>
    </div>

    <div v-if="!schedule.isLoading && schedule.availableFiles.length === 0 && !schedule.events.length" class="welcome-card">
      <h2>👋 Bienvenue sur ICSExplorer</h2>
      <p>Les emplois du temps de l'école ne sont pas encore disponibles sur ce serveur.</p>
      <p class="welcome-help">
        En attendant, vous pouvez afficher votre propre planning ADE.
        <em>Administrateur :</em> renseignez <code>AGALAN_LOGIN</code> / <code>AGALAN_PASSWORD</code> pour activer la synchronisation automatique.
      </p>
      <v-btn color="primary" variant="flat" @click="openPersonalSchedule">Configurer mon planning ADE</v-btn>
    </div>

    <template v-else>

      <WeekStats
        compact
        class="stats-row"
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
      >
        <template #toolbar-actions>
          <v-btn
            class="filters-btn"
            variant="text"
            density="comfortable"
            icon
            :aria-label="schedule.disabledSubjects.length ? `Matières (${schedule.disabledSubjects.length} masquées)` : 'Matières et heures de la semaine'"
            @click="filtersOpen = true"
          >
            <v-badge v-if="schedule.disabledSubjects.length" :content="schedule.disabledSubjects.length" color="error" floating>
              <v-icon :icon="mdiFilterVariant" />
            </v-badge>
            <v-icon v-else :icon="mdiFilterVariant" />
          </v-btn>
        </template>
      </PlanningGrid>

      <v-bottom-sheet v-model="filtersOpen">
        <v-card v-swipe-dismiss="() => (filtersOpen = false)" class="filters-sheet">
          <div class="grabber" aria-hidden="true" />
          <v-card-title class="filters-title">Matières de la semaine</v-card-title>
          <v-card-text>
            <p class="filters-hint">Touchez une matière pour la masquer du planning.</p>
            <WeekStats
              :events="schedule.weekEvents"
              :disabled-subjects="schedule.disabledSubjects"
              @filter="schedule.toggleSubjectFilter"
              @reset="schedule.resetSubjectFilters"
            />
          </v-card-text>
        </v-card>
      </v-bottom-sheet>
    </template>
  </div>
</template>

<style scoped>
/* Fill the space between the top bar and the tab bar (or the screen bottom). */
.planning-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: calc(100dvh - var(--v-layout-top, 64px) - var(--nav-h));
  padding-top: 6px;
  padding-bottom: 6px;
}

@media (min-width: 960px) {
  /* Desktop: use the width (the grid adapts), comfortable margins. */
  .planning-screen {
    width: min(1680px, calc(100% - 48px));
    height: calc(100dvh - var(--v-layout-top, 64px));
    gap: 10px;
    padding-top: 16px;
    padding-bottom: 16px;
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

.welcome-card {
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
}

.welcome-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

.welcome-help {
  font-size: 0.9rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.status-message-text {
  flex: 1;
}

/* Phones: stats move to the filters sheet; wider screens keep the chip row. */
.filters-btn {
  display: none;
}

@media (max-width: 599px) {
  .stats-row {
    display: none;
  }

  .filters-btn {
    display: inline-flex;
    overflow: visible;
  }

  .filters-btn :deep(.v-btn__content) {
    overflow: visible;
  }
}

.filters-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}

.grabber {
  width: 36px;
  height: 4px;
  margin: 10px auto 0;
  border-radius: 2px;
  background: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.4;
}

.filters-title {
  font-weight: 700;
}

.filters-hint {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

</style>

<style>
.v-theme--dark .planning-screen .status-banner {
  background: rgba(var(--v-theme-primary), 0.12);
}
</style>
