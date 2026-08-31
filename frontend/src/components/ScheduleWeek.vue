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

const { isDark, toggleTheme } = useTheme();

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

    const clampedStart = Math.max(s.getTime(), dayScheduleStart.getTime());
    const clampedEnd = Math.min(e.getTime(), dayScheduleEnd.getTime());

    const top = getEventTop(new Date(clampedStart));
    const height = Math.max(22, ((clampedEnd - clampedStart) / (1000 * 60 * 60)) * pxPerHour.value);

    return {
      event,
      startT: clampedStart,
      endT: clampedEnd,
      top,
      height,
      displayTime: formatChunkTime(event, dayDate),
    };
  });

  items.sort((a, b) => a.startT - b.startT || b.endT - a.endT);

  const layout = new Map();
  let cluster = [];
  let clusterMaxEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const cols = [];
    cluster.forEach((item) => {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        if (cols[c] <= item.startT) {
          cols[c] = item.endT;
          layout.set(item.event, { col: c, cols: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        layout.set(item.event, { col: cols.length, cols: 0 });
        cols.push(item.endT);
      }
    });

    const totalCols = cols.length;
    cluster.forEach((item) => {
      const pos = layout.get(item.event);
      if (pos) pos.cols = totalCols;
    });

    cluster = [];
    clusterMaxEnd = -1;
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

function getEventTop(date) {
  const d = new Date(date);
  const minutes = (d.getHours() - hourStart.value) * 60 + d.getMinutes();
  return Math.max(0, (minutes / 60) * pxPerHour.value);
}

// Current time indicator
const currentTime = ref(new Date());
let timeInterval = null;

const currentTimeFormatted = computed(() => {
  return formatTimeOnly(currentTime.value);
});

const isDayToday = (date) => {
  return formatDateOnly(date) === formatDateOnly(currentTime.value);
};

const currentTimeTop = computed(() => {
  const h = currentTime.value.getHours();
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

// Touch gestures (swipe)
let touchStartX = 0;
let touchStartY = 0;

const onTouchStart = (e) => {
  if (e.touches && e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
};

const onTouchEnd = (e) => {
  if (e.changedTouches && e.changedTouches.length === 1) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        if (activeDayIndex.value < 4) {
          scrollDayIntoView(activeDayIndex.value + 1);
        } else {
          emit("nextWeek");
        }
      } else {
        if (activeDayIndex.value > 0) {
          scrollDayIntoView(activeDayIndex.value - 1);
        } else {
          emit("prevWeek");
        }
      }
    }
  }
};

// Global keyboard shortcuts
const handleGlobalKeydown = (e) => {
  const tag = e.target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;

  if (e.key === "t" || e.key === "T") {
    emit("currentWeek");
  } else if (e.key === "ArrowLeft") {
    emit("prevWeek");
  } else if (e.key === "ArrowRight") {
    emit("nextWeek");
  } else if (e.key === "d" || e.key === "D") {
    toggleTheme();
  }
};

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 30000);
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
  window.removeEventListener("keydown", handleGlobalKeydown);
});

const datePickerRef = ref(null);

const datePickerValue = computed(() => {
  const d = startDate.value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});

const openDatePicker = () => {
  if (datePickerRef.value) {
    if (typeof datePickerRef.value.showPicker === "function") {
      try {
        datePickerRef.value.showPicker();
      } catch {
        datePickerRef.value.focus();
        datePickerRef.value.click();
      }
    } else {
      datePickerRef.value.focus();
      datePickerRef.value.click();
    }
  }
};

const onDatePickerChange = (val) => {
  if (val) {
    const [y, m, d] = val.split("-").map(Number);
    emit("jumpToWeek", new Date(y, m - 1, d, 12, 0, 0));
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
      <div class="nav-arrows">
        <button class="nav-btn" type="button" aria-label="Semaine précédente (Flèche gauche)" title="Semaine précédente (←)" @click="emit('prevWeek')">
          ◀
        </button>
        <button
          type="button"
          class="week-label-btn"
          title="Cliquer pour choisir une date dans le calendrier"
          @click="openDatePicker"
        >
          <span>📅 Semaine du {{ formatDateOnly(startDate) }}</span>
          <input
            ref="datePickerRef"
            type="date"
            class="week-date-picker"
            :value="datePickerValue"
            aria-label="Choisir une date dans le calendrier"
            @change="onDatePickerChange($event.target.value)"
            @click.stop
          />
        </button>
        <button class="nav-btn" type="button" aria-label="Semaine suivante (Flèche droite)" title="Semaine suivante (→)" @click="emit('nextWeek')">
          ▶
        </button>
      </div>

      <button class="btn btn-outline today-btn" type="button" title="Revenir à la semaine actuelle (Touche T)" @click="emit('currentWeek')">
        📍 Aujourd'hui
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
        Aller au prochain cours ➔
      </button>
    </div>

    <!-- Schedule Grid -->
    <div
      v-else
      ref="scheduleContainer"
      class="schedule"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
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
          <!-- Realtime red line indicator with timestamp badge -->
          <div
            v-if="isDayToday(day.date) && currentTimeTop !== null"
            class="current-time-line"
            :style="{ top: `${currentTimeTop}px` }"
            aria-hidden="true"
          >
            <span class="current-time-badge">{{ currentTimeFormatted }}</span>
          </div>

          <!-- Course Events -->
          <div
            v-for="ev in day.events"
            :key="ev.uid || ev.summary"
            class="event"
            :class="{
              'event-cercle': isCercleEvent(ev),
              'event-compact': ev.height < 48
            }"
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
            <span v-if="ev.height >= 48" class="event-time">
              {{ ev.displayTime }}
            </span>
            <span v-if="ev.location && ev.height >= 60" class="event-location">
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
  flex-wrap: wrap;
}

.nav-arrows {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.week-label-btn {
  position: relative;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  transition: all 0.15s ease;
}

.week-label-btn:hover {
  background: var(--bg);
  border-color: var(--accent);
}

.week-date-picker {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.current-time-badge {
  position: absolute;
  left: 2px;
  top: -10px;
  background: #ef4444;
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  line-height: 1;
}

.event.event-compact {
  padding: 0.15rem 0.35rem;
  justify-content: center;
}

.event.event-compact .event-title {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
