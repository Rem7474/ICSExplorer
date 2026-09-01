<template>
  <div class="schedule-skeleton" aria-hidden="true">
    <div class="skeleton-day" v-for="day in 5" :key="day">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton-events">
        <div class="skeleton skeleton-event event-1"></div>
        <div class="skeleton skeleton-event event-2"></div>
        <div class="skeleton skeleton-event event-3"></div>
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
