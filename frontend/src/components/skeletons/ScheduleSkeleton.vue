<!-- Placeholder with the planning's shape (toolbar, day header, hour rail
     and a few courses) while the first schedule loads. -->

<template>
  <div class="schedule-skeleton" aria-hidden="true">
    <div class="sk-toolbar">
      <span class="sk sk-btn" />
      <span class="sk sk-period" />
      <span class="sk sk-btn" />
    </div>
    <div class="sk-days">
      <span v-for="d in 5" :key="d" class="sk sk-day" />
    </div>
    <div class="sk-body">
      <div class="sk-rail">
        <span v-for="h in 6" :key="h" class="sk sk-hour" />
      </div>
      <div class="sk-events">
        <span class="sk sk-event" style="top: 4%; height: 18%" />
        <span class="sk sk-event" style="top: 38%; height: 10%" />
        <span class="sk sk-event" style="top: 54%; height: 20%" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 320px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.06) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.06) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.sk-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sk-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.sk-period {
  flex: 0 1 180px;
  height: 22px;
}

.sk-days {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.sk-day {
  height: 44px;
  border-radius: 14px;
}

.sk-body {
  position: relative;
  display: flex;
  flex: 1;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
}

.sk-rail {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 28px;
}

.sk-hour {
  height: 12px;
}

.sk-events {
  position: relative;
  flex: 1;
}

.sk-event {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: 12px;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
