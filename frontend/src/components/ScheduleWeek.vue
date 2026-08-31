<script setup>
import { ref, computed, onMounted, onUnmounted, unref } from "vue";
import { formatDateOnly, formatTimeOnly } from "../utils/dates.js";
import { getSubjectType, getSubjectColors, isCercleEvent } from "../utils/colors.js";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  events: {
    type: [Array, Object],
    default: () => [],
  },
  currentWeekStart: {
    type: [Date, String, Object],
    required: true,
  },
  allEvents: {
    type: [Array, Object],
    default: () => [],
  },
});

const emit = defineEmits(["prevWeek", "nextWeek", "currentWeek", "eventClick", "jumpToWeek"]);

const { isDark } = useTheme();

const SCHEDULE_PX = 600;
const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;

const rawEvents = computed(() => {
  const evs = unref(props.events);
  return Array.isArray(evs) ? evs : [];
});

const rawAllEvents = computed(() => {
  const evs = unref(props.allEvents);
  return Array.isArray(evs) ? evs : [];
});

const startDate = computed(() => {
  const d = unref(props.currentWeekStart);
  return d instanceof Date ? d : new Date(d || Date.now());
});

// Dynamic hour boundaries based on week events
const hourStart = computed(() => {
  const evs = rawEvents.value;
  if (!evs.length) return DEFAULT_HOUR_START;
  const startHours = [];
  evs.forEach((e) => {
    const s = new Date(e.start);
    startHours.push(s.getHours());
  });
  const minH = Math.min(...startHours);
  return Math.max(6, Math.min(DEFAULT_HOUR_START, minH));
});

const hourEnd = computed(() => {
  const evs = rawEvents.value;
  if (!evs.length) return DEFAULT_HOUR_END;
  const endHours = [];
  evs.forEach((e) => {
    const s = new Date(e.start);
    const end = new Date(e.end);
    if (formatDateOnly(s) === formatDateOnly(end)) {
      endHours.push(end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
    } else {
      // Event crosses day boundary: span till evening on start day
      endHours.push(Math.max(20, Math.min(23, s.getHours() + 4)));
    }
  });
  const maxH = Math.max(DEFAULT_HOUR_END, ...endHours);
  return Math.min(24, maxH);
});

const hoursTotal = computed(() => Math.max(1, hourEnd.value - hourStart.value));
const pxPerHour = computed(() => SCHEDULE_PX / hoursTotal.value);

// Helper for multi-day time display
function formatChunkTime(event, dayDate) {
  const s = new Date(event.start);
  const e = new Date(event.end);
  const sameDay = formatDateOnly(s) === formatDateOnly(e);

  if (sameDay) {
    return `${formatTimeOnly(s)} - ${formatTimeOnly(e)}`;
  }

  const isStartDay = formatDateOnly(s) === formatDateOnly(dayDate);
  const isEndDay = formatDateOnly(e) === formatDateOnly(dayDate);

  if (isStartDay) {
    return `${formatTimeOnly(s)} → ${formatDateOnly(e)} ${formatTimeOnly(e)}`;
  }
  if (isEndDay) {
    return `Jusqu'à ${formatTimeOnly(e)}`;
  }
  return `Toute la journée`;
}

// Group events by 5 days (Monday to Friday)
const days = computed(() => {
  const list = [];
  const start = new Date(startDate.value);

  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + i);
    const dayKey = formatDateOnly(dayDate);

    const dayStartMidnight = new Date(dayDate);
    dayStartMidnight.setHours(0, 0, 0, 0);

    const dayEndMidnight = new Date(dayDate);
    dayEndMidnight.setHours(23, 59, 59, 999);

    // Filter events overlapping this day
    const dayEvents = rawEvents.value.filter((e) => {
      const s = new Date(e.start);
      const end = new Date(e.end);
      return s <= dayEndMidnight && end >= dayStartMidnight;
    });

    list.push({
      date: dayDate,
      dayKey,
      dayName: dayDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      events: layoutDayEvents(dayEvents, dayDate),
    });
  }

  return list;
});

// Collision packing algorithm bounded per day
function layoutDayEvents(events, dayDate) {
  const dayScheduleStart = new Date(dayDate);
  dayScheduleStart.setHours(hourStart.value, 0, 0, 0);

  const dayScheduleEnd = new Date(dayDate);
  dayScheduleEnd.setHours(hourEnd.value, 0, 0, 0);

  const items = events.map((event) => {
    const s = new Date(event.start);
    const e = new Date(event.end);

    // Clamp visible start and end within day schedule window
    const clampedStart = Math.max(s.getTime(), dayScheduleStart.getTime());
    const clampedEnd = Math.min(e.getTime(), dayScheduleEnd.getTime());

    const relStartHours = Math.max(0, (clampedStart - dayScheduleStart.getTime()) / 3600000);
    const relEndHours = Math.max(relStartHours + 0.5, (clampedEnd - dayScheduleStart.getTime()) / 3600000);

    const top = Math.max(0, relStartHours * pxPerHour.value);
    const rawHeight = (relEndHours - relStartHours) * pxPerHour.value;
    const height = Math.max(24, Math.min(SCHEDULE_PX - top, rawHeight));

    return {
      event,
      startT: clampedStart,
      endT: Math.max(clampedStart + 1800000, clampedEnd),
      top,
      height,
      displayTime: formatChunkTime(event, dayDate),
    };
  });

  items.sort((a, b) => a.startT - b.startT || b.endT - a.endT);

  const layout = new Map();
  let cluster = [];
  let clusterMaxEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = [];
    const colByIdx = [];

    cluster.forEach((item) => {
      let lane = lanes.findIndex((endT) => endT <= item.startT);
      if (lane === -1) {
        lanes.push(item.endT);
        lane = lanes.length - 1;
      } else {
        lanes[lane] = item.endT;
      }
      colByIdx.push(lane);
    });

    const cols = lanes.length;
    cluster.forEach((item, idx) => {
      layout.set(item.event, { col: colByIdx[idx], cols });
    });

    cluster = [];
    clusterMaxEnd = -Infinity;
  };

  for (const item of items) {
    if (item.startT >= clusterMaxEnd) flush();
    cluster.push(item);
    clusterMaxEnd = Math.max(clusterMaxEnd, item.endT);
  }
  flush();

  return items.map((item) => {
    const pos = layout.get(item.event) || { col: 0, cols: 1 };
    return {
      ...item.event,
      col: pos.col,
      cols: pos.cols,
      top: item.top,
      height: item.height,
      displayTime: item.displayTime,
    };
  });
}

// Current time indicator
const currentTime = ref(new Date());
let timeInterval = null;

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});

const isDayToday = (date) => {
  return formatDateOnly(date) === formatDateOnly(currentTime.value);
};

const currentTimeTop = computed(() => {
  const h = currentTime.value.getHours();
  const m = currentTime.value.getMinutes();
  if (h < hourStart.value || h >= hourEnd.value) return null;
  return getEventTop(currentTime.value);
});

// Mobile Day dots & horizontal scrolling
const activeDayIndex = ref(0);
const scheduleContainer = ref(null);

const scrollDayIntoView = (idx) => {
  activeDayIndex.value = idx;
  if (scheduleContainer.value) {
    const groups = scheduleContainer.value.querySelectorAll(".day-group");
    if (groups[idx]) {
      groups[idx].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }
};

// Empty state details
const nextAvailableEvent = computed(() => {
  const now = new Date();
  return rawAllEvents.value.find((e) => new Date(e.start) > now) || null;
});
</script>

<template>
  <div class="schedule-wrapper">
    <!-- Week Navigation Header -->
    <div class="week-nav-bar">
      <button class="nav-btn" type="button" aria-label="Semaine précédente" @click="emit('prevWeek')">
        ◀
      </button>
      <div class="week-label">
        Semaine du {{ formatDateOnly(startDate) }}
      </div>
      <button class="nav-btn" type="button" aria-label="Semaine suivante" @click="emit('nextWeek')">
        ▶
      </button>
      <button class="btn btn-outline today-btn" type="button" @click="emit('currentWeek')">
        Semaine actuelle
      </button>
    </div>

    <!-- Mobile Day Dots -->
    <div class="day-dots" role="tablist">
      <button
        v-for="(day, idx) in days"
        :key="day.dayKey"
        type="button"
        class="day-dot"
        :class="{ active: activeDayIndex === idx, today: isDayToday(day.date) }"
        @click="scrollDayIntoView(idx)"
      >
        {{ day.dayName.split(' ')[0] }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="rawEvents.length === 0" class="empty-state card">
      <h3>🏖️ Pas de cours cette semaine</h3>
      <p v-if="nextAvailableEvent">
        Prochain cours le <strong>{{ formatDateOnly(nextAvailableEvent.start) }}</strong>
      </p>
      <p v-else>Aucun cours trouvé pour cet emploi du temps.</p>
      <button
        v-if="nextAvailableEvent"
        class="btn btn-primary"
        type="button"
        @click="emit('jumpToWeek', nextAvailableEvent.start)"
      >
        Aller au prochain cours
      </button>
    </div>

    <!-- Schedule Grid -->
    <div v-else ref="scheduleContainer" class="schedule">
      <!-- Hour Rail -->
      <div class="hour-rail" aria-hidden="true">
        <div class="hour-rail-spacer">&nbsp;</div>
        <div class="hour-rail-body" :style="{ minHeight: `${SCHEDULE_PX}px` }">
          <span
            v-for="h in (hourEnd - hourStart + 1)"
            :key="h"
            class="hour-tick"
            :style="{ top: `${(h - 1) * pxPerHour}px` }"
          >
            {{ hourStart + h - 1 }}h
          </span>
        </div>
      </div>

      <!-- Day Columns -->
      <div
        v-for="day in days"
        :key="day.dayKey"
        class="day-group"
        :class="{ today: isDayToday(day.date) }"
      >
        <div class="day-title">{{ day.dayName }}</div>
        <div class="day-schedule" :style="{ minHeight: `${SCHEDULE_PX}px` }">
          <!-- Realtime red line indicator -->
          <div
            v-if="isDayToday(day.date) && currentTimeTop !== null"
            class="current-time-line"
            :style="{ top: `${currentTimeTop}px` }"
            aria-hidden="true"
          ></div>

          <!-- Course Events -->
          <div
            v-for="ev in day.events"
            :key="ev.uid || ev.summary"
            class="event"
            :class="{ 'event-cercle': isCercleEvent(ev) }"
            tabindex="0"
            role="button"
            :style="{
              top: `${ev.top}px`,
              height: `${ev.height}px`,
              left: `calc(${(ev.col / ev.cols) * 100}% + 2px)`,
              width: `calc(${(1 / ev.cols) * 100}% - 4px)`,
              backgroundColor: getSubjectColors(ev, isDark).background,
              borderColor: getSubjectColors(ev, isDark).border,
              color: getSubjectColors(ev, isDark).text,
            }"
            @click="emit('eventClick', ev)"
            @keydown.enter="emit('eventClick', ev)"
            @keydown.space.prevent="emit('eventClick', ev)"
          >
            <span v-if="isCercleEvent(ev)" class="cercle-event-badge">
              🎉 Cercle Esisar
            </span>
            <h4 class="event-title">{{ ev.summary }}</h4>
            <span class="event-time">
              {{ ev.displayTime }}
            </span>
            <span v-if="ev.location" class="event-location">
              📍 {{ ev.location }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.week-nav-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
}

.nav-btn {
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
}

.nav-btn:hover {
  border-color: var(--accent);
}

.week-label {
  font-size: 1.1rem;
  font-weight: 700;
  text-align: center;
}

.day-dots {
  display: none;
  justify-content: center;
  gap: 0.5rem;
}

.day-dot {
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}

.day-dot.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.day-dot.today {
  font-weight: bold;
}

.schedule {
  display: grid;
  grid-template-columns: 48px repeat(5, 1fr);
  gap: 0.5rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  overflow-x: auto;
}

.hour-rail {
  display: flex;
  flex-direction: column;
}

.hour-rail-spacer {
  height: 38px;
}

.hour-rail-body {
  position: relative;
}

.hour-tick {
  position: absolute;
  font-size: 0.75rem;
  color: var(--muted);
  transform: translateY(-50%);
  right: 6px;
}

.day-group {
  display: flex;
  flex-direction: column;
}

.day-title {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.5rem;
  text-transform: capitalize;
}

.day-group.today .day-title {
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}

.day-schedule {
  position: relative;
  background: rgba(125, 125, 125, 0.03);
  border-radius: 8px;
  border: 1px dashed var(--border);
  overflow: hidden;
}

.current-time-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #ef4444;
  z-index: 10;
}

.current-time-line::before {
  content: "";
  position: absolute;
  left: -4px;
  top: -3px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
}

.event {
  position: absolute;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border-left-width: 4px;
  border-left-style: solid;
  border-top-width: 1px;
  border-right-width: 1px;
  border-bottom-width: 1px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  z-index: 2;
}

.event:hover {
  transform: scale(1.02);
  z-index: 5;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.event-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}

.cercle-event-badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(147, 51, 234, 0.2);
  color: #7e22ce;
  margin-bottom: 0.1rem;
}

:global(.dark-mode) .cercle-event-badge {
  background: rgba(192, 132, 252, 0.25);
  color: #f3e8ff;
}

.event.event-cercle {
  border-left-width: 5px;
  box-shadow: 0 1px 3px rgba(147, 51, 234, 0.15);
}

.event-time {
  font-size: 0.72rem;
  opacity: 0.85;
}

.event-location {
  font-size: 0.72rem;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
}

@media (max-width: 768px) {
  .day-dots {
    display: flex;
  }

  .hour-rail {
    display: none;
  }

  .schedule {
    grid-template-columns: repeat(5, 100%);
    scroll-snap-type: x mandatory;
    padding: 0.5rem;
  }

  .day-group {
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
}
</style>
