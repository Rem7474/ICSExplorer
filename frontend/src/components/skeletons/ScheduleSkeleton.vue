<script setup>
import Skeleton from "primevue/skeleton";
</script>

<template>
  <div class="schedule-skeleton" aria-hidden="true">
    <div v-for="day in 5" :key="day" class="skeleton-day">
      <Skeleton width="65%" height="28px" class="skeleton-title" />
      <div class="skeleton-events">
        <Skeleton height="90px" border-radius="8px" class="skeleton-event" />
        <Skeleton height="140px" border-radius="8px" class="skeleton-event" />
        <Skeleton height="75px" border-radius="8px" class="skeleton-event" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-skeleton {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  min-height: 520px;
  width: 100%;
}

.skeleton-day {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
}

.skeleton-title {
  height: 24px;
  width: 70%;
  margin: 0 auto;
  border-radius: 4px;
}

.skeleton-events {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.skeleton-event {
  border-radius: 6px;
  width: 100%;
}

.event-1 {
  height: 90px;
}

.event-2 {
  height: 140px;
}

.event-3 {
  height: 75px;
}

@media (max-width: 768px) {
  .schedule-skeleton {
    grid-template-columns: 1fr;
  }
}
</style>
