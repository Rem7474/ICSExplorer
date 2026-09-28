<script setup>
import { inject } from "vue";
import { getWeekStart } from "../utils/dates.js";
import NextCourseCard from "../components/NextCourseCard.vue";
import WeekStats from "../components/WeekStats.vue";
import ScheduleWeek from "../components/ScheduleWeek.vue";
import ScheduleSkeleton from "../components/skeletons/ScheduleSkeleton.vue";
import NextCourseSkeleton from "../components/skeletons/NextCourseSkeleton.vue";
import WeekStatsSkeleton from "../components/skeletons/WeekStatsSkeleton.vue";

// Planning screen: the displayed schedule (next course, week stats, grid).
const schedule = inject("schedule");
const openPersonalSchedule = inject("openPersonalSchedule");

const onJumpToWeek = (date) => {
  schedule.currentWeekStart = getWeekStart(new Date(date));
};
</script>

<template>
  <div class="screen container">
    <!-- Status or error message -->
    <div v-if="schedule.statusMessage" class="status-banner card" role="status">
      <span class="status-message-text">{{ schedule.statusMessage }}</span>
      <button
        v-if="schedule.statusAction === 'configure-personal'"
        type="button"
        class="btn btn-primary btn-sm status-action-btn"
        @click="openPersonalSchedule"
      >
        ✨ Configurer mon planning ADE
      </button>
    </div>

    <!-- Welcome card if the server has no calendar yet -->
    <div v-if="!schedule.isLoading && schedule.availableFiles.length === 0" class="welcome-card card">
      <h2>👋 Bienvenue sur ICSExplorer</h2>
      <p>Les emplois du temps de l'école ne sont pas encore disponibles sur ce serveur.</p>
      <p class="welcome-help">
        En attendant, vous pouvez afficher votre propre planning ADE.
        <em>Administrateur :</em> renseignez <code>AGALAN_LOGIN</code> / <code>AGALAN_PASSWORD</code> pour activer la synchronisation automatique.
      </p>
      <div class="welcome-actions">
        <button class="btn btn-primary" type="button" @click="openPersonalSchedule">
          ✨ Configurer mon planning ADE
        </button>
      </div>
    </div>

    <template v-else>
      <NextCourseSkeleton v-if="schedule.isLoading && !schedule.nextCourse" />
      <NextCourseCard v-else-if="schedule.nextCourse" :course="schedule.nextCourse" @click="schedule.openEventModal" />

      <div id="planning" class="card schedule-main-card" tabindex="-1">
        <WeekStatsSkeleton v-if="schedule.isLoading && schedule.weekEvents.length === 0" />
        <WeekStats
          v-else
          :events="schedule.weekEvents"
          :disabled-subjects="schedule.disabledSubjects"
          @filter="schedule.toggleSubjectFilter"
          @reset="schedule.resetSubjectFilters"
        />

        <ScheduleSkeleton v-if="schedule.isLoading && schedule.events.length === 0" />
        <ScheduleWeek
          v-else
          :events="schedule.displayedWeekEvents"
          :all-events="schedule.events"
          :current-week-start="schedule.currentWeekStart"
          @prev-week="schedule.prevWeek"
          @next-week="schedule.nextWeek"
          @current-week="schedule.goToCurrentWeek"
          @event-click="schedule.openEventModal"
          @jump-to-week="onJumpToWeek"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: var(--accent);
  border-left: 4px solid var(--accent);
}

.status-message-text {
  flex: 1;
}

.status-action-btn {
  font-weight: 600;
  white-space: nowrap;
}

.schedule-main-card {
  padding: 1.5rem;
}

.schedule-main-card:focus {
  outline: none;
}

@media (max-width: 768px) {
  .schedule-main-card {
    padding: 0.75rem 0.5rem;
  }
}
</style>
