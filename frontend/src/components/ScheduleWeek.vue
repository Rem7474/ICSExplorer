<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, unref } from "vue";
import Button from "primevue/button";
import { formatDateOnly, formatTimeOnly, isAllDayEvent, getWeekStart } from "../utils/dates.js";
import { getSubjectColors, isCercleEvent, isRuEvent } from "../utils/colors.js";
import { useTheme } from "../composables/useTheme.js";

function getDayWeekday(date) {
  return date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase();
}

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

// Dynamic hour boundaries based ONLY on timed events of the week
const timedEvents = computed(() => {
  return rawEvents.value.filter((e) => !isAllDayEvent(e));
});

const hourStart = computed(() => {
  const evs = timedEvents.value;
  if (!evs.length) return DEFAULT_HOUR_START;
  const startHours = evs.map((e) => new Date(e.start).getHours());
  const minH = Math.min(...startHours);
  return Math.max(7, Math.min(DEFAULT_HOUR_START, minH));
});

const hourEnd = computed(() => {
  const evs = timedEvents.value;
  if (!evs.length) return DEFAULT_HOUR_END;
  const endHours = evs.map((e) => {
    const s = new Date(e.start);
    const end = new Date(e.end);
    if (formatDateOnly(s) === formatDateOnly(end)) {
      return end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
    }
    // Multi-day timed event on start day: ensure at least startHour + 2 so slot is visible
    const sHour = s.getHours() + (s.getMinutes() > 0 ? 1 : 0);
    return Math.max(DEFAULT_HOUR_END, sHour + 2);
  });
  const maxH = Math.max(DEFAULT_HOUR_END, ...endHours);
  return Math.min(23, maxH);
});

const hoursTotal = computed(() => Math.max(1, hourEnd.value - hourStart.value));
const pxPerHour = computed(() => SCHEDULE_PX / hoursTotal.value);

// Helper for timed event display
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
  return `${formatTimeOnly(s)} - ${formatTimeOnly(e)}`;
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

    const dayAllEvents = dayEvents.filter((e) => isAllDayEvent(e, dayDate));
    const dayTimedEvents = dayEvents.filter((e) => !isAllDayEvent(e, dayDate));

    list.push({
      date: dayDate,
      dayKey,
      dayName: dayDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      allDayEvents: dayAllEvents,
      events: layoutDayEvents(dayTimedEvents, dayDate),
    });
  }

  return list;
});

const hasAnyAllDayEvents = computed(() => {
  return days.value.some((d) => d.allDayEvents && d.allDayEvents.length > 0);
});

const maxAllDayCount = computed(() => {
  if (!hasAnyAllDayEvents.value) return 0;
  return Math.max(1, ...days.value.map((d) => d.allDayEvents?.length || 0));
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
function getTodayDayIndex() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
  return day >= 1 && day <= 5 ? day - 1 : 0;
}

const activeDayIndex = ref(0);
const scheduleContainer = ref(null);

const MOBILE_VIEW_MODE_KEY = "edtMobileViewMode";
const mobileViewMode = ref("day");

try {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(MOBILE_VIEW_MODE_KEY);
    if (saved === "week" || saved === "day") {
      mobileViewMode.value = saved;
    }
  }
} catch {}

const setMobileViewMode = (mode) => {
  mobileViewMode.value = mode;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MOBILE_VIEW_MODE_KEY, mode);
    }
  } catch {}
  if (mode === "day") {
    nextTick(() => {
      scrollDayIntoView(activeDayIndex.value, "auto");
    });
  }
};

const onSelectMobileDay = (idx) => {
  if (mobileViewMode.value !== "day") {
    setMobileViewMode("day");
  }
  scrollDayIntoView(idx);
};

const onDayHeaderClick = (idx) => {
  if (mobileViewMode.value === "week") {
    setMobileViewMode("day");
    nextTick(() => {
      scrollDayIntoView(idx);
    });
  }
};

const scrollDayIntoView = (idx, behavior = "smooth") => {
  activeDayIndex.value = idx;
  if (scheduleContainer.value) {
    const groups = scheduleContainer.value.querySelectorAll(".day-group");
    if (groups[idx]) {
      const targetLeft = groups[idx].offsetLeft ?? 0;
      if (typeof scheduleContainer.value.scrollTo === "function") {
        try {
          scheduleContainer.value.scrollTo({ left: targetLeft, behavior });
        } catch {
          scheduleContainer.value.scrollLeft = targetLeft;
        }
      } else if (typeof groups[idx].scrollIntoView === "function") {
        try {
          groups[idx].scrollIntoView({ behavior, inline: "start", block: "nearest" });
        } catch {
          scheduleContainer.value.scrollLeft = targetLeft;
        }
      } else {
        scheduleContainer.value.scrollLeft = targetLeft;
      }
    } else if (idx === 0) {
      scheduleContainer.value.scrollLeft = 0;
    }
  }
};

const onScheduleScroll = () => {
  if (mobileViewMode.value === "week") return;
  if (!scheduleContainer.value) return;
  const container = scheduleContainer.value;
  if (container.scrollWidth <= container.clientWidth) return;

  const groups = container.querySelectorAll(".day-group");
  if (!groups || groups.length === 0) return;

  const scrollLeft = container.scrollLeft;
  let closestIndex = 0;
  let minDiff = Infinity;

  groups.forEach((group, idx) => {
    const diff = Math.abs(group.offsetLeft - scrollLeft);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = idx;
    }
  });

  if (activeDayIndex.value !== closestIndex) {
    activeDayIndex.value = closestIndex;
  }
};

// Navigation direction & transitions between weeks
const transitionClass = ref("");
let isNavigating = false;

function triggerFallbackTransition(direction) {
  transitionClass.value = "";
  nextTick(() => {
    transitionClass.value = `anim-${direction}`;
  });
}

const onAnimationEnd = () => {
  transitionClass.value = "";
};

function navigateWithDirection(direction, action) {
  isNavigating = true;

  const performUpdate = () => {
    action();
  };

  if (
    typeof document !== "undefined" &&
    document.startViewTransition &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  ) {
    document.documentElement.dataset.navDir = direction;
    try {
      const vt = document.startViewTransition(async () => {
        performUpdate();
        await nextTick();
      });
      vt.finished
        .catch(() => {})
        .finally(() => {
          delete document.documentElement.dataset.navDir;
          isNavigating = false;
        });
    } catch {
      delete document.documentElement.dataset.navDir;
      performUpdate();
      triggerFallbackTransition(direction);
      isNavigating = false;
    }
  } else {
    performUpdate();
    triggerFallbackTransition(direction);
    isNavigating = false;
  }
}

const onPrevWeek = (targetDay = 0) => {
  const targetDayIndex = typeof targetDay === "number" ? targetDay : 0;
  activeDayIndex.value = targetDayIndex;
  navigateWithDirection("prev", () => {
    emit("prevWeek");
  });
  nextTick(() => {
    scrollDayIntoView(targetDayIndex, "auto");
  });
};

const onNextWeek = (targetDay = 0) => {
  const targetDayIndex = typeof targetDay === "number" ? targetDay : 0;
  activeDayIndex.value = targetDayIndex;
  navigateWithDirection("next", () => {
    emit("nextWeek");
  });
  nextTick(() => {
    scrollDayIntoView(targetDayIndex, "auto");
  });
};

const onToday = () => {
  const todayIdx = getTodayDayIndex();
  activeDayIndex.value = todayIdx;
  const now = new Date();
  const currentWeekTime = getWeekStart(now).getTime();
  const displayedWeekTime = startDate.value.getTime();
  const dir = currentWeekTime > displayedWeekTime ? "next" : currentWeekTime < displayedWeekTime ? "prev" : "fade";

  navigateWithDirection(dir, () => {
    emit("currentWeek");
  });
  nextTick(() => {
    scrollDayIntoView(todayIdx, "smooth");
  });
};

const onJumpToNextCourse = () => {
  if (nextAvailableEvent.value) {
    const evDate = new Date(nextAvailableEvent.value.start);
    const day = evDate.getDay();
    const dayIdx = day >= 1 && day <= 5 ? day - 1 : 0;
    activeDayIndex.value = dayIdx;
    navigateWithDirection("next", () => {
      emit("jumpToWeek", nextAvailableEvent.value.start);
    });
  }
};

watch(startDate, async (newVal, oldVal) => {
  await nextTick();
  scrollDayIntoView(activeDayIndex.value, "auto");
  if (!isNavigating && newVal && oldVal) {
    const newT = new Date(newVal).getTime();
    const oldT = new Date(oldVal).getTime();
    if (newT !== oldT) {
      const dir = newT > oldT ? "next" : "prev";
      triggerFallbackTransition(dir);
    }
  }
});

watch(
  () => rawEvents.value.length,
  async (newLen, oldLen) => {
    if (newLen > 0 && oldLen === 0) {
      await nextTick();
      scrollDayIntoView(activeDayIndex.value, "auto");
    }
  }
);

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
      if (rawEvents.value.length === 0 || mobileViewMode.value === "week") {
        if (dx < 0) {
          onNextWeek(0);
        } else {
          onPrevWeek(4);
        }
        return;
      }

      if (dx < 0) {
        if (activeDayIndex.value < 4) {
          scrollDayIntoView(activeDayIndex.value + 1);
        } else {
          onNextWeek(0);
        }
      } else {
        if (activeDayIndex.value > 0) {
          scrollDayIntoView(activeDayIndex.value - 1);
        } else {
          onPrevWeek(4);
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
    onToday();
  } else if (e.key === "ArrowLeft") {
    onPrevWeek();
  } else if (e.key === "ArrowRight") {
    onNextWeek();
  } else if (e.key === "d" || e.key === "D") {
    toggleTheme();
  }
};

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 30000);
  window.addEventListener("keydown", handleGlobalKeydown);

  // If initial week displayed is current week, default activeDayIndex to today
  const now = new Date();
  const isCurrentWeek = formatDateOnly(startDate.value) === formatDateOnly(getWeekStart(now));
  if (isCurrentWeek) {
    const todayIdx = getTodayDayIndex();
    activeDayIndex.value = todayIdx;
    if (scheduleContainer.value) {
      scrollDayIntoView(todayIdx, "auto");
    }
  }
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
    const chosenDate = new Date(y, m - 1, d, 12, 0, 0);
    const day = chosenDate.getDay();
    const dayIdx = day >= 1 && day <= 5 ? day - 1 : 0;
    activeDayIndex.value = dayIdx;

    const chosenWeekTime = getWeekStart(chosenDate).getTime();
    const currentWeekTime = startDate.value.getTime();
    const dir = chosenWeekTime > currentWeekTime ? "next" : chosenWeekTime < currentWeekTime ? "prev" : "fade";

    navigateWithDirection(dir, () => {
      emit("jumpToWeek", chosenDate);
    });
  }
};

// Empty state details
const nextAvailableEvent = computed(() => {
  const now = new Date();
  return rawAllEvents.value.find((e) => new Date(e.start) > now) || null;
});

defineExpose({
  activeDayIndex,
  getTodayDayIndex,
  onPrevWeek,
  onNextWeek,
  onToday,
  scrollDayIntoView,
  onScheduleScroll,
  transitionClass,
  navigateWithDirection,
});
</script>

<template>
  <div class="schedule-wrapper">
    <!-- Week Navigation Header -->
    <div class="week-nav-bar">
      <div class="nav-arrows">
        <Button
          icon="pi pi-chevron-left"
          severity="secondary"
          text
          rounded
          class="nav-arrow-btn"
          aria-label="Semaine précédente (Flèche gauche)"
          title="Semaine précédente (←)"
          @click="onPrevWeek"
        />

        <div class="week-picker-trigger" @click="openDatePicker">
          <Button
            type="button"
            severity="secondary"
            outlined
            class="week-label-btn"
            title="Cliquer pour choisir une date dans le calendrier"
          >
            <i class="pi pi-calendar mr-2" style="color: var(--accent);" aria-hidden="true"></i>
            <span class="week-label-text">
              <span class="week-label-prefix">Semaine du </span>{{ formatDateOnly(startDate) }}
            </span>
          </Button>
          <input
            ref="datePickerRef"
            type="date"
            class="week-date-picker"
            :value="datePickerValue"
            aria-label="Choisir une date dans le calendrier"
            @change="onDatePickerChange($event.target.value)"
            @click.stop
          />
        </div>

        <Button
          icon="pi pi-chevron-right"
          severity="secondary"
          text
          rounded
          class="nav-arrow-btn"
          aria-label="Semaine suivante (Flèche droite)"
          title="Semaine suivante (→)"
          @click="onNextWeek"
        />
      </div>

      <Button
        severity="secondary"
        outlined
        size="small"
        class="today-btn"
        aria-label="Revenir à la semaine actuelle (Touche T)"
        title="Revenir à la semaine actuelle (Touche T)"
        @click="onToday"
      >
        <i class="pi pi-compass" aria-hidden="true"></i>
        <span class="today-text">Aujourd'hui</span>
      </Button>
    </div>

    <!-- Mobile Day Navigation & View Mode Toggle -->
    <div class="mobile-nav-bar">
      <div class="day-dots" role="tablist">
        <button
          v-for="(day, idx) in days"
          :key="day.dayKey"
          type="button"
          class="day-dot"
          :class="{ active: mobileViewMode === 'day' && activeDayIndex === idx, today: isDayToday(day.date) }"
          :title="`Afficher ${day.dayName}`"
          @click="onSelectMobileDay(idx)"
        >
          {{ day.dayName.split(' ')[0] }}
        </button>
      </div>

      <div class="mobile-view-toggle" role="group" aria-label="Mode d'affichage">
        <button
          type="button"
          class="view-toggle-btn"
          :class="{ active: mobileViewMode === 'day' }"
          title="Vue 1 jour"
          aria-label="Vue 1 jour"
          @click="setMobileViewMode('day')"
        >
          1J
        </button>
        <button
          type="button"
          class="view-toggle-btn"
          :class="{ active: mobileViewMode === 'week' }"
          title="Vue semaine complète (5 jours)"
          aria-label="Vue semaine"
          @click="setMobileViewMode('week')"
        >
          5J
        </button>
      </div>
    </div>

    <!-- Schedule Viewport (with Week Transition) -->
    <div
      class="schedule-viewport"
      :class="transitionClass"
      @animationend="onAnimationEnd"
    >
      <!-- Empty State -->
      <div
        v-if="rawEvents.length === 0"
        class="empty-state card"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
      >
      <div class="empty-state-icon">
        <i class="pi pi-calendar-times" style="font-size: 2.2rem; color: var(--muted);"></i>
      </div>
      <h3>Pas de cours cette semaine</h3>
      <p v-if="nextAvailableEvent">
        Prochain cours le <strong>{{ formatDateOnly(nextAvailableEvent.start) }}</strong>
      </p>
      <p v-else>Aucun cours trouvé pour cet emploi du temps.</p>
      <Button
        v-if="nextAvailableEvent"
        label="Aller au prochain cours"
        icon="pi pi-arrow-right"
        iconPos="right"
        severity="primary"
        @click="onJumpToNextCourse"
      />
    </div>

    <!-- Schedule Grid -->
    <div
      v-else
      ref="scheduleContainer"
      class="schedule"
      :class="{ 'mobile-view-week': mobileViewMode === 'week' }"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
      @scroll.passive="onScheduleScroll"
    >
      <!-- Hour Rail -->
      <div class="hour-rail" aria-hidden="true">
        <div class="hour-rail-spacer">&nbsp;</div>
        <div
          v-if="hasAnyAllDayEvents"
          class="hour-rail-allday"
          :style="{ minHeight: `${maxAllDayCount * 32}px` }"
        >
          Journée
        </div>
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
        v-for="(day, idx) in days"
        :key="day.dayKey"
        class="day-group"
        :class="{ today: isDayToday(day.date) }"
      >
        <div
          class="day-title"
          :class="{
            'day-title-today': isDayToday(day.date),
            'day-title-clickable': mobileViewMode === 'week'
          }"
          :title="mobileViewMode === 'week' ? `Cliquer pour zoomer sur ${day.dayName}` : day.dayName"
          @click="onDayHeaderClick(idx)"
        >
          <span class="day-weekday">{{ getDayWeekday(day.date) }}</span>
          <span class="day-number-badge" :class="{ 'badge-today': isDayToday(day.date) }">
            {{ day.date.getDate() }}
          </span>
        </div>

        <!-- All-Day / Multi-Day Events Banner Area -->
        <div
          v-if="hasAnyAllDayEvents"
          class="day-allday-container"
          :style="{ minHeight: `${maxAllDayCount * 32}px` }"
        >
          <div
            v-for="ev in day.allDayEvents"
            :key="ev.uid || ev.summary"
            class="allday-badge"
            :class="{
              'event-ru': isRuEvent(ev),
              'event-cercle': isCercleEvent(ev),
            }"
            tabindex="0"
            role="button"
            :title="ev.summary + (ev.location ? ' — ' + ev.location : '')"
            :style="{
              backgroundColor: getSubjectColors(ev, isDark).background,
              borderColor: getSubjectColors(ev, isDark).border,
              color: getSubjectColors(ev, isDark).text,
            }"
            @click="emit('eventClick', ev)"
            @keydown.enter="emit('eventClick', ev)"
            @keydown.space.prevent="emit('eventClick', ev)"
          >
            <span v-if="isRuEvent(ev)" class="ru-event-badge mr-1">
              <i class="pi pi-utensils" aria-hidden="true"></i> RU Briff'O
            </span>
            <span v-else-if="isCercleEvent(ev)" class="cercle-event-badge mr-1">
              <i class="pi pi-sparkles" aria-hidden="true"></i> Cercle Esisar
            </span>
            <span class="allday-title">{{ ev.summary }}</span>
            <span v-if="ev.location" class="allday-loc">📍 {{ ev.location }}</span>
          </div>
        </div>

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
              'event-ru': isRuEvent(ev),
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
            <span v-if="isRuEvent(ev)" class="ru-event-badge">
              <i class="pi pi-utensils" aria-hidden="true"></i> RU Briff'O
            </span>
            <span v-else-if="isCercleEvent(ev)" class="cercle-event-badge">
              <i class="pi pi-sparkles" aria-hidden="true"></i> Cercle Esisar
            </span>
            <h4 class="event-title">{{ ev.summary }}</h4>
            <span v-if="ev.height >= 48" class="event-time">
              <i class="pi pi-clock" aria-hidden="true"></i> {{ ev.displayTime }}
            </span>
            <span v-if="ev.location && ev.height >= 60" class="event-location">
              <i class="pi pi-map-pin" aria-hidden="true"></i> {{ ev.location }}
            </span>
          </div>
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
  gap: 0.5rem;
  width: 100%;
}

.nav-arrows {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: nowrap;
}

.nav-arrow-btn {
  flex-shrink: 0;
}

.today-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

@media (max-width: 640px) {
  .week-nav-bar {
    width: 100%;
    gap: 0.35rem;
  }

  .nav-arrows {
    flex: 1;
    min-width: 0;
    gap: 0.25rem;
    flex-wrap: nowrap !important;
  }

  .nav-arrow-btn {
    flex-shrink: 0 !important;
  }

  .week-picker-trigger {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .week-label-btn {
    width: 100%;
    font-size: 0.88rem;
    padding: 0.4rem 0.45rem;
    justify-content: center;
  }

  .today-btn {
    flex-shrink: 0 !important;
    padding: 0.45rem 0.6rem !important;
    margin-left: 0;
  }

  .today-btn .today-text {
    display: none !important;
  }
}

@media (max-width: 640px) {
  .week-label-prefix {
    display: none;
  }
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

.week-picker-trigger {
  position: relative;
  display: inline-flex;
}

.week-label-btn {
  position: relative;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
}

.week-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.mobile-nav-bar {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

.mobile-view-toggle {
  display: inline-flex;
  align-items: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.view-toggle-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.55rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  line-height: 1.2;
}

.view-toggle-btn.active {
  background: var(--accent);
  color: white !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
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
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  transition: all 0.15s ease;
}

.day-dot.today {
  font-weight: 700;
  border-color: var(--accent);
  color: var(--accent);
}

.day-dot.today:not(.active) {
  background: rgba(37, 99, 235, 0.08);
}

:global(.dark-mode) .day-dot.today:not(.active) {
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--accent);
  color: #93c5fd;
}

.day-dot.active {
  background: var(--accent);
  color: white !important;
  border-color: var(--accent);
}

.schedule-viewport {
  position: relative;
  width: 100%;
  view-transition-name: schedule-viewport;
}

/* Fallback CSS animations for browsers without View Transitions */
@keyframes scheduleSlideInNext {
  0% {
    opacity: 0.15;
    transform: translate3d(36px, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes scheduleSlideInPrev {
  0% {
    opacity: 0.15;
    transform: translate3d(-36px, 0, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes scheduleFadeIn {
  0% {
    opacity: 0.2;
    transform: scale(0.99);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.schedule-viewport.anim-next {
  animation: scheduleSlideInNext 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: transform, opacity;
}

.schedule-viewport.anim-prev {
  animation: scheduleSlideInPrev 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: transform, opacity;
}

.schedule-viewport.anim-fade {
  animation: scheduleFadeIn 0.2s ease-out both;
  will-change: transform, opacity;
}

/* View Transitions Pseudo-elements styling */
:global(::view-transition-old(root)),
:global(::view-transition-new(root)) {
  animation: none !important;
}

:global(::view-transition-old(schedule-viewport)),
:global(::view-transition-new(schedule-viewport)) {
  animation-duration: 0.25s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  animation-fill-mode: both;
}

:global(html[data-nav-dir="next"]::view-transition-old(schedule-viewport)) {
  animation-name: vtSlideOutLeft;
}
:global(html[data-nav-dir="next"]::view-transition-new(schedule-viewport)) {
  animation-name: vtSlideInRight;
}

:global(html[data-nav-dir="prev"]::view-transition-old(schedule-viewport)) {
  animation-name: vtSlideOutRight;
}
:global(html[data-nav-dir="prev"]::view-transition-new(schedule-viewport)) {
  animation-name: vtSlideInLeft;
}

:global(html[data-nav-dir="fade"]::view-transition-old(schedule-viewport)) {
  animation-name: vtFadeOut;
}
:global(html[data-nav-dir="fade"]::view-transition-new(schedule-viewport)) {
  animation-name: vtFadeIn;
}

@keyframes vtSlideOutLeft {
  to {
    opacity: 0;
    transform: translate3d(-36px, 0, 0);
  }
}
@keyframes vtSlideInRight {
  from {
    opacity: 0;
    transform: translate3d(36px, 0, 0);
  }
}
@keyframes vtSlideOutRight {
  to {
    opacity: 0;
    transform: translate3d(36px, 0, 0);
  }
}
@keyframes vtSlideInLeft {
  from {
    opacity: 0;
    transform: translate3d(-36px, 0, 0);
  }
}

@keyframes vtFadeOut {
  to {
    opacity: 0;
  }
}
@keyframes vtFadeIn {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .schedule-viewport.anim-next,
  .schedule-viewport.anim-prev,
  .schedule-viewport.anim-fade {
    animation: none !important;
  }

  :global(::view-transition-group(schedule-viewport)),
  :global(::view-transition-old(schedule-viewport)),
  :global(::view-transition-new(schedule-viewport)) {
    animation: none !important;
  }
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

.week-picker-trigger {
  position: relative;
  display: inline-flex;
}

.hour-rail {
  display: flex;
  flex-direction: column;
}

.hour-rail-spacer {
  height: 52px;
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
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.5rem;
  padding-bottom: 4px;
}

.day-title.day-title-today {
  border-bottom-color: var(--accent);
}

.day-weekday {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.day-number-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text);
  transition: all 0.2s ease;
}

.day-number-badge.badge-today {
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

.hour-rail-allday {
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.day-allday-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.allday-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border-left-width: 4px;
  border-left-style: solid;
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.allday-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px -1px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.allday-title {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.allday-loc {
  font-size: 0.7rem;
  font-weight: 600;
  opacity: 0.85;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  gap: 0.75rem;
}

.empty-state-icon {
  margin-bottom: 0.25rem;
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
  border-top-style: solid;
  border-right-style: solid;
  border-bottom-style: solid;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

@media (hover: hover) and (pointer: fine) {
  .event:hover {
    transform: translateY(-1px) scale(1.015);
    z-index: 5;
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.18);
  }
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

.ru-event-badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(234, 88, 12, 0.2);
  color: #9a3412;
  margin-bottom: 0.1rem;
}

:global(.dark-mode) .ru-event-badge {
  background: rgba(251, 146, 60, 0.25);
  color: #ffedd5;
}

.event.event-ru {
  border-left-width: 5px;
  box-shadow: 0 1px 3px rgba(234, 88, 12, 0.15);
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
  touch-action: pan-y;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
}

@media (max-width: 768px) {
  .mobile-nav-bar {
    display: flex;
  }

  .day-dots {
    display: flex;
    flex: 1;
    justify-content: flex-start;
    gap: 0.35rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .day-dots::-webkit-scrollbar {
    display: none;
  }

  .day-dot {
    padding: 0.25rem 0.55rem;
    font-size: 0.78rem;
    flex: 1;
    text-align: center;
    min-width: 0;
  }

  .hour-rail {
    display: none;
  }

  /* Default Day Mode: 1 day per slide with scroll-snap */
  .schedule {
    grid-template-columns: repeat(5, 100%);
    gap: 0;
    padding: 0.5rem 0;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .schedule::-webkit-scrollbar {
    display: none;
  }

  .day-group {
    scroll-snap-align: start;
    scroll-snap-stop: always;
    box-sizing: border-box;
    padding: 0 0.5rem;
    width: 100%;
    min-width: 100%;
    max-width: 100%;
  }

  /* Week Mode (5J) on Mobile: all 5 days side-by-side */
  .schedule.mobile-view-week {
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: 3px !important;
    padding: 0.35rem 0 !important;
    scroll-snap-type: none !important;
    overflow-x: hidden !important;
  }

  .schedule.mobile-view-week .day-group {
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    padding: 0 !important;
    scroll-snap-align: none !important;
  }

  .schedule.mobile-view-week .day-title {
    padding: 0.25rem 0.1rem;
    font-size: 0.72rem;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .schedule.mobile-view-week .day-title:active {
    background: rgba(59, 130, 246, 0.15);
  }

  .schedule.mobile-view-week .day-weekday {
    font-size: 0.65rem;
  }

  .schedule.mobile-view-week .day-number-badge {
    width: 18px;
    height: 18px;
    font-size: 0.62rem;
  }

  .schedule.mobile-view-week .event {
    padding: 0.15rem 0.2rem;
    border-left-width: 3px;
    gap: 0.05rem;
    border-radius: 4px;
  }

  .schedule.mobile-view-week .event-title {
    font-size: 0.65rem;
    line-height: 1.1;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .schedule.mobile-view-week .event-time {
    display: none;
  }

  .schedule.mobile-view-week .event-location {
    font-size: 0.58rem;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .schedule.mobile-view-week .ru-event-badge,
  .schedule.mobile-view-week .cercle-event-badge {
    font-size: 0.52rem;
    padding: 0 0.2rem;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
