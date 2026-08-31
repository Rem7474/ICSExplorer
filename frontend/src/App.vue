<script setup>
import { onMounted, computed, reactive, unref } from "vue";
import { useSchedule } from "./composables/useSchedule.js";

import AppHeader from "./components/AppHeader.vue";
import ScheduleControls from "./components/ScheduleControls.vue";
import FavoritesBar from "./components/FavoritesBar.vue";
import NextCourseCard from "./components/NextCourseCard.vue";
import WeekStats from "./components/WeekStats.vue";
import ScheduleWeek from "./components/ScheduleWeek.vue";
import EventModal from "./components/EventModal.vue";
import EmptyRoomsModal from "./components/EmptyRoomsModal.vue";

import ScheduleSkeleton from "./components/skeletons/ScheduleSkeleton.vue";
import NextCourseSkeleton from "./components/skeletons/NextCourseSkeleton.vue";
import WeekStatsSkeleton from "./components/skeletons/WeekStatsSkeleton.vue";

const schedule = reactive(useSchedule());

onMounted(() => {
  schedule.init();
});

const currentKey = computed(() => {
  const mode = unref(schedule.selectedMode);
  const teacher = unref(schedule.selectedTeacher);
  const room = unref(schedule.selectedRoom);
  const file = unref(schedule.selectedFile);

  if (mode === "teacher" && teacher) return `teacher_${teacher}`;
  if (mode === "room" && room) return `room_${room}`;
  if (file && typeof file === "string") return `file_${file}`;
  return "";
});

const onSelectFavorite = (fav) => {
  if (fav.mode === "student") {
    schedule.selectedMode = "student";
    schedule.loadSchedule(fav.file);
  } else if (fav.mode === "teacher") {
    schedule.selectedMode = "teacher";
    schedule.selectedTeacher = fav.teacher;
    schedule.loadTeacherSchedule(fav.teacher);
  } else if (fav.mode === "room") {
    schedule.selectedMode = "room";
    schedule.selectedRoom = fav.room;
    schedule.loadRoomSchedule(fav.room);
  }
};

const onJumpToWeek = (date) => {
  schedule.currentWeekStart = new Date(date);
};
</script>

<template>
  <div class="app-root">
    <AppHeader :health="schedule.serverHealth" />

    <main class="container">
      <!-- Upcoming course card -->
      <NextCourseSkeleton v-if="schedule.isLoading && !schedule.nextCourse" />
      <NextCourseCard
        v-else-if="schedule.nextCourse"
        :course="schedule.nextCourse"
        @click="schedule.activeModalEvent = $event"
      />

      <!-- Controls & Selectors -->
      <ScheduleControls
        :schedule="schedule"
        @open-empty-rooms="schedule.openRoomModal"
      />

      <!-- Favorites Bar -->
      <FavoritesBar :current-key="currentKey" @select="onSelectFavorite" />

      <!-- Status or error message -->
      <div v-if="schedule.statusMessage" class="status-banner card">
        {{ schedule.statusMessage }}
      </div>

      <!-- Welcome card if 0 files -->
      <div v-if="!schedule.isLoading && schedule.availableFiles.length === 0" class="welcome-card card">
        <h2>👋 Bienvenue sur EDT Esisar</h2>
        <p>Aucun emploi du temps n'est actuellement présent sur le serveur.</p>
        <p class="welcome-help">
          Pour récupérer automatiquement l'ensemble des plannings de l'école, renseignez vos identifiants <strong>Agalan (Grenoble INP)</strong> dans votre fichier <code>.env</code> (ou variables d'environnement) puis lancez la synchronisation.
        </p>
        <div class="welcome-actions">
          <button class="btn btn-primary" type="button" @click="schedule.triggerSync">
            🔄 Lancer la synchronisation ADE
          </button>
        </div>
      </div>

      <!-- Schedule Section -->
      <div v-else class="card schedule-main-card">
        <!-- Week Statistics & Subject Filter Chips -->
        <WeekStatsSkeleton v-if="schedule.isLoading && schedule.weekEvents.length === 0" />
        <WeekStats
          v-else
          :events="schedule.weekEvents"
          :active-filter="schedule.selectedSubjectFilter"
          @filter="schedule.toggleSubjectFilter"
        />

        <!-- Main Schedule Grid -->
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
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="container footer-content">
        <span>EDT Esisar — Propulsé par Vue 3 & Go</span>
        <div class="footer-links">
          <a href="/api/health" target="_blank" rel="noopener">Santé API</a>
          <a href="/api/status" target="_blank" rel="noopener">Statut Synchro</a>
          <a href="/output/files.json" target="_blank" rel="noopener">Index Fichiers</a>
        </div>
      </div>
    </footer>

    <!-- Modals -->
    <EventModal
      v-if="schedule.activeModalEvent"
      :event="schedule.activeModalEvent"
      @close="schedule.closeEventModal"
    />

    <EmptyRoomsModal
      v-if="schedule.isRoomModalOpen"
      @close="schedule.closeRoomModal"
    />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}

.status-banner {
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: var(--accent);
  border-left: 4px solid var(--accent);
}

.schedule-main-card {
  padding: 1.5rem;
}

.footer {
  margin-top: 2rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.footer-links {
  display: flex;
  gap: 1rem;
}

.footer-links a {
  color: var(--muted);
  text-decoration: none;
}

.footer-links a:hover {
  color: var(--accent);
  text-decoration: underline;
}
</style>
