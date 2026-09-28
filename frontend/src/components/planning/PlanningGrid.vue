<script setup>
// Planning grid built on native browser scrolling: a single scroll container,
// CSS scroll-snap per day (1-day view) or per week (5-day view), sticky hour
// rail and day headers. The previous, current and next weeks are rendered;
// when the user settles on a neighbouring week, the parent week changes and
// the scroll position is re-centred on the same day, so swiping never ends.
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { mdiChevronLeft, mdiChevronRight, mdiCalendarToday } from "@mdi/js";
import { getWeekStart, formatDateOnly, formatTimeOnly } from "../../utils/dates.js";
import { getSubjectColors, isCercleEvent, isRuEvent } from "../../utils/colors.js";
import { eventsOfDay, hourRange, layoutDay } from "../../utils/dayLayout.js";
import { useTheme } from "../../composables/useTheme.js";

const props = defineProps({
  events: { type: Array, default: () => [] },
  weekStart: { type: Date, required: true },
});
const emit = defineEmits(["update:weekStart", "eventClick"]);

const { isDark } = useTheme();

const RAIL = 44;
// Hour height adapts so the whole day fits the available height (like v2),
// but never below a readable minimum: then the grid scrolls vertically.
const MIN_PX_PER_HOUR = 34;
const MAX_PX_PER_HOUR = 90;
const BODY_GAP = 8; // space above and below the hours
const DAYS_PER_WEEK = 5;
const MIDDLE = DAYS_PER_WEEK; // first column of the current week
const VIEW_MODE_KEY = "edtMobileViewMode"; // "day" | "week" (kept from v2)

// ------------------------------------------------------------------ view mode
const readMode = () => {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "day" || saved === "week") return saved;
  } catch {}
  return window.matchMedia?.("(max-width: 599px)")?.matches ? "day" : "week";
};
const mode = ref(readMode());
const perPage = computed(() => (mode.value === "day" ? 1 : DAYS_PER_WEEK));

// ------------------------------------------------------------------- columns
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const now = ref(new Date());
const isToday = (date) => formatDateOnly(date) === formatDateOnly(now.value);

const columns = computed(() => {
  const base = getWeekStart(props.weekStart);
  const list = [];
  for (let week = -1; week <= 1; week++) {
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const date = addDays(base, week * 7 + d);
      const { allDay, timed } = eventsOfDay(props.events, date);
      list.push({ key: date.toDateString(), date, week, allDay, timed });
    }
  }
  return list;
});

const range = computed(() => hourRange(columns.value.flatMap((c) => c.timed)));

// Same header height for every column (room for the most all-day banners),
// so hours stay aligned across days.
// Column headers share one height so hours stay aligned. In the 1-day view the
// day is already shown by the chips above: the header only holds all-day banners.
const maxAllDay = computed(() => Math.max(0, ...columns.value.map((c) => c.allDay.length)));
const headHeight = computed(() => {
  if (mode.value === "week") return 52 + 26 * maxAllDay.value;
  return maxAllDay.value ? 10 + 26 * maxAllDay.value : 0;
});

const availableHeight = ref(0); // scroller height, measured by the ResizeObserver
const pxPerHour = computed(() => {
  const hoursCount = Math.max(1, range.value.end - range.value.start);
  const fit = (availableHeight.value - headHeight.value - 2 * BODY_GAP - 2) / hoursCount;
  if (!Number.isFinite(fit) || fit <= 0) return 60;
  return Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, fit));
});
const gridHeight = computed(() => (range.value.end - range.value.start) * pxPerHour.value);
const hours = computed(() => Array.from({ length: range.value.end - range.value.start + 1 }, (_, i) => range.value.start + i));

const laidOut = computed(() =>
  columns.value.map((c) => ({
    ...c,
    items: layoutDay(c.timed, c.date, { hourStart: range.value.start, hourEnd: range.value.end, pxPerHour: pxPerHour.value }),
  }))
);

const nowTop = computed(() => {
  const h = now.value.getHours() + now.value.getMinutes() / 60;
  if (h < range.value.start || h > range.value.end) return null;
  return (h - range.value.start) * pxPerHour.value;
});

// -------------------------------------------------------------------- scroll
const scroller = ref(null);
const activeIndex = ref(MIDDLE); // column shown at the left edge
let pendingIndex = null; // column to show once the parent has moved the week
let programmatic = false;
let settleTimer = null;

const colWidth = () => {
  const el = scroller.value;
  return el ? (el.clientWidth - RAIL) / perPage.value : 0;
};

const scrollToColumn = (index, behavior = "auto") => {
  const el = scroller.value;
  const w = colWidth();
  if (!el || w <= 0) {
    activeIndex.value = index;
    return;
  }
  programmatic = behavior === "auto";
  el.scrollTo({ left: index * w, behavior });
  if (behavior === "auto") {
    activeIndex.value = index;
    requestAnimationFrame(() => (programmatic = false));
  }
};

const shiftWeek = (direction, landingIndex) => {
  pendingIndex = landingIndex;
  emit("update:weekStart", addDays(getWeekStart(props.weekStart), direction * 7));
};

// Called once scrolling has stopped: switch week when a neighbour is shown.
const settle = () => {
  const w = colWidth();
  if (!scroller.value || w <= 0 || programmatic) return;
  const index = Math.round(scroller.value.scrollLeft / w);
  if (index < MIDDLE) shiftWeek(-1, index + DAYS_PER_WEEK);
  else if (index >= MIDDLE + DAYS_PER_WEEK) shiftWeek(1, index - DAYS_PER_WEEK);
  else activeIndex.value = index;
};

const onScroll = () => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 120);
};

// Day to show when the week changes from outside (schedule loaded, today, date picker).
const defaultDayIndex = () => {
  const week = columns.value.slice(MIDDLE, MIDDLE + DAYS_PER_WEEK);
  const today = week.findIndex((c) => isToday(c.date));
  if (today >= 0) return today;
  const firstBusy = week.findIndex((c) => c.timed.length || c.allDay.length);
  return firstBusy >= 0 ? firstBusy : 0;
};

const landingColumn = (dayIndex) => MIDDLE + (mode.value === "day" ? dayIndex : 0);

// Opens the day on the current hour (today) or on its first course.
const scrollToFirstHour = () => {
  const el = scroller.value;
  if (!el) return;
  const visible = laidOut.value.slice(activeIndex.value, activeIndex.value + perPage.value);
  const todayShown = visible.some((c) => isToday(c.date));
  let target = 0;
  if (todayShown && nowTop.value !== null) target = nowTop.value - pxPerHour.value;
  else {
    const tops = visible.flatMap((c) => c.items.map((i) => i.top));
    if (tops.length) target = Math.min(...tops) - pxPerHour.value / 2;
  }
  el.scrollTop = Math.max(0, target);
};

watch(
  () => getWeekStart(props.weekStart).getTime(),
  async () => {
    await nextTick();
    if (pendingIndex !== null) {
      scrollToColumn(pendingIndex);
      pendingIndex = null;
    } else {
      scrollToColumn(landingColumn(defaultDayIndex()));
      scrollToFirstHour();
    }
  }
);

watch(mode, async (m) => {
  try {
    localStorage.setItem(VIEW_MODE_KEY, m);
  } catch {}
  await nextTick();
  const day = (activeIndex.value - MIDDLE + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  scrollToColumn(landingColumn(m === "day" ? day : 0));
});

// ---------------------------------------------------------------- navigation
const currentWeek = computed(() => columns.value.slice(MIDDLE, MIDDLE + DAYS_PER_WEEK));
const activeDay = computed(() => Math.min(DAYS_PER_WEEK - 1, Math.max(0, activeIndex.value - MIDDLE)));

const goToDay = (dayIndex) => {
  if (mode.value !== "day") mode.value = "day";
  nextTick(() => scrollToColumn(MIDDLE + dayIndex, "smooth"));
};

const step = (direction) => {
  const target = mode.value === "day" ? activeIndex.value + direction : MIDDLE + direction * DAYS_PER_WEEK;
  scrollToColumn(target, "smooth");
};

const goToDate = (date) => {
  const target = new Date(date);
  const weekday = (target.getDay() + 6) % 7; // Monday = 0
  const dayIndex = Math.min(weekday, DAYS_PER_WEEK - 1);
  const targetWeek = getWeekStart(target).getTime();
  if (targetWeek === getWeekStart(props.weekStart).getTime()) {
    scrollToColumn(landingColumn(dayIndex), "smooth");
  } else {
    pendingIndex = landingColumn(dayIndex);
    emit("update:weekStart", getWeekStart(target));
  }
};

const goToToday = () => goToDate(new Date());

const dateInput = ref(null);
const dateInputValue = computed(() => {
  const d = currentWeek.value[mode.value === "day" ? activeDay.value : 0].date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const openDatePicker = () => {
  try {
    dateInput.value?.showPicker();
  } catch {
    dateInput.value?.focus();
  }
};
const onDatePicked = (value) => {
  if (value) goToDate(new Date(`${value}T12:00:00`));
};

// Week range in both views: in the 1-day view the chips below show the day.
const periodLabel = computed(() => {
  const first = currentWeek.value[0].date;
  const last = currentWeek.value[DAYS_PER_WEEK - 1].date;
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(first)} – ${fmt(last)}`;
});

// Empty week: offer to jump to the next course.
const weekIsEmpty = computed(() => currentWeek.value.every((c) => !c.timed.length && !c.allDay.length));
const nextEvent = computed(() => {
  const after = addDays(currentWeek.value[DAYS_PER_WEEK - 1].date, 1).getTime();
  return props.events.filter((e) => new Date(e.start).getTime() >= after).sort((a, b) => new Date(a.start) - new Date(b.start))[0] || null;
});

// ------------------------------------------------------------------- display
const dayLabel = (date) => date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dow = (date) => date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

const eventStyle = (item) => {
  const accent = getSubjectColors(item.event, isDark.value).border;
  const surface = "rgb(var(--v-theme-surface))";
  const ink = "rgb(var(--v-theme-on-surface))";
  return {
    top: `${item.top}px`,
    height: `${item.height}px`,
    left: `calc(${(item.col / item.cols) * 100}% + 2px)`,
    width: `calc(${100 / item.cols}% - 4px)`,
    "--accent": accent,
    background: `color-mix(in srgb, ${accent} ${isDark.value ? 30 : 17}%, ${surface})`,
    color: `color-mix(in srgb, ${accent} ${isDark.value ? 25 : 55}%, ${ink})`,
  };
};

const bannerStyle = (event) => {
  const accent = getSubjectColors(event, isDark.value).border;
  return { "--accent": accent, background: `color-mix(in srgb, ${accent} 22%, rgb(var(--v-theme-surface)))` };
};

// Titles fit on one line: the RU/Cercle marker is part of the title instead
// of an extra line (which got cut off in one-hour slots).
const eventTitle = (event) => {
  const summary = event.summary || "Événement";
  if (isRuEvent(event)) return mode.value === "week" ? "🍽️ RU" : summary;
  if (isCercleEvent(event) && !/^\p{Extended_Pictographic}/u.test(summary)) return `🎉 ${summary}`;
  return summary;
};

// RU menu: the first dish of the day is more useful than the (always 12h–13h) time.
const ruHighlight = (event) =>
  (event.description || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("•"))
    ?.replace(/^•\s*/, "") || "";

// Second piece of information: the first dish for RU menus, the time otherwise.
const eventDetail = (item) => {
  // Narrow 5-day columns: a short slot keeps only its title.
  if (mode.value === "week" && item.height < 44) return "";
  return isRuEvent(item.event) ? ruHighlight(item.event) : item.time;
};

const eventLabel = (item, date) =>
  [item.event.summary || "Événement", dayLabel(date), item.time, item.event.location ? `salle ${item.event.location}` : ""]
    .filter(Boolean)
    .join(", ");

// ------------------------------------------------------------------ keyboard
const onKeydown = (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || e.target?.isContentEditable) return;
  if (document.querySelector(".v-overlay--active")) return; // a dialog/sheet is open
  if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "ArrowRight") step(1);
  else if (e.key === "t" || e.key === "T") goToToday();
  else return;
  e.preventDefault();
};

// ------------------------------------------------------------------ lifecycle
let clock = null;
let resizeObserver = null;

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  scroller.value?.addEventListener("scrollend", settle);
  clock = setInterval(() => (now.value = new Date()), 30000);
  resizeObserver = new ResizeObserver(() => {
    availableHeight.value = scroller.value?.clientHeight || 0;
    scrollToColumn(activeIndex.value);
  });
  availableHeight.value = scroller.value?.clientHeight || 0;
  if (scroller.value) resizeObserver.observe(scroller.value);
  await nextTick();
  scrollToColumn(landingColumn(defaultDayIndex()));
  scrollToFirstHour();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  scroller.value?.removeEventListener("scrollend", settle);
  clearInterval(clock);
  clearTimeout(settleTimer);
  resizeObserver?.disconnect();
});

defineExpose({ goToDate, goToToday, step, mode, activeIndex });
</script>

<template>
  <div class="planning-grid" :class="`mode-${mode}`">
    <!-- Toolbar: period, navigation, 1J / 5J -->
    <div class="grid-toolbar">
      <v-btn :icon="mdiChevronLeft" variant="text" density="comfortable" :aria-label="mode === 'day' ? 'Jour précédent' : 'Semaine précédente'" @click="step(-1)" />
      <button type="button" class="period-btn" :aria-label="`Choisir une date — ${periodLabel}`" @click="openDatePicker">
        {{ periodLabel }}
      </button>
      <input ref="dateInput" type="date" class="date-input" tabindex="-1" aria-hidden="true" :value="dateInputValue" @change="onDatePicked($event.target.value)" />
      <v-btn :icon="mdiChevronRight" variant="text" density="comfortable" :aria-label="mode === 'day' ? 'Jour suivant' : 'Semaine suivante'" @click="step(1)" />
      <v-btn :icon="mdiCalendarToday" variant="text" density="comfortable" aria-label="Aujourd'hui (T)" title="Aujourd'hui (T)" @click="goToToday" />
      <slot name="toolbar-actions" />
      <div class="span-toggle" role="group" aria-label="Nombre de jours affichés">
        <button
          v-for="opt in [{ v: 'day', l: '1J', a: 'Vue jour' }, { v: 'week', l: '5J', a: 'Vue semaine' }]"
          :key="opt.v"
          type="button"
          class="span-btn"
          :class="{ active: mode === opt.v }"
          :aria-pressed="mode === opt.v"
          :aria-label="opt.a"
          @click="mode = opt.v"
        >
          {{ opt.l }}
        </button>
      </div>
    </div>

    <!-- Day chips of the current week (1-day view; in 5-day view the column headers play this role) -->
    <div v-if="mode === 'day'" class="day-chips" role="tablist" aria-label="Jour affiché">
      <button
        v-for="(c, i) in currentWeek"
        :key="c.key"
        type="button"
        class="day-chip"
        role="tab"
        :class="{ active: mode === 'week' || i === activeDay, today: isToday(c.date) }"
        :aria-selected="mode === 'day' && i === activeDay"
        :aria-label="dayLabel(c.date)"
        @click="goToDay(i)"
      >
        <span class="dow">{{ dow(c.date) }}</span>
        <span class="num">{{ c.date.getDate() }}</span>
      </button>
    </div>

    <button v-if="weekIsEmpty && nextEvent" type="button" class="next-course-hint" @click="goToDate(nextEvent.start)">
      Pas de cours cette semaine · prochain le {{ formatDateOnly(nextEvent.start) }} →
    </button>

    <!-- Native scrolling grid -->
    <div
      ref="scroller"
      class="grid-scroller"
      role="region"
      aria-label="Planning"
      :style="{ '--rail': `${RAIL}px`, '--per-page': perPage, '--grid-h': `${gridHeight}px`, '--head-h': `${headHeight}px` }"
      @scroll.passive="onScroll"
    >
      <div class="rail" aria-hidden="true">
        <div class="rail-corner" />
        <div class="rail-hours">
          <span v-for="h in hours" :key="h" class="hour" :style="{ top: `${(h - range.start) * pxPerHour}px` }">{{ h }}h</span>
        </div>
      </div>

      <section
        v-for="c in laidOut"
        :key="c.key"
        class="day-col"
        :class="{ today: isToday(c.date), 'week-start': c.date.getDay() === 1 }"
        :aria-label="dayLabel(c.date)"
      >
        <header class="day-head" :class="{ empty: headHeight === 0 }">
          <component
            :is="mode === 'week' && c.week === 0 ? 'button' : 'span'"
            v-if="mode === 'week'"
            class="day-date"
            :type="mode === 'week' && c.week === 0 ? 'button' : undefined"
            :aria-label="mode === 'week' && c.week === 0 ? `Afficher ${dayLabel(c.date)}` : undefined"
            @click="mode === 'week' && c.week === 0 && goToDay(currentWeek.findIndex((d) => d.key === c.key))"
          >
            <span class="dow">{{ dow(c.date) }}</span>
            <span class="num" :class="{ today: isToday(c.date) }">{{ c.date.getDate() }}</span>
          </component>
          <button
            v-for="e in c.allDay"
            :key="`${e.uid || e.summary}-allday`"
            type="button"
            class="allday"
            :style="bannerStyle(e)"
            :aria-label="`${e.summary}, ${dayLabel(c.date)}, toute la journée`"
            @click="emit('eventClick', e)"
          >
            {{ e.summary }}
          </button>
        </header>

        <div class="day-body">
          <div v-for="h in hours" :key="h" class="hour-line" :style="{ top: `${(h - range.start) * pxPerHour}px` }" />
          <div v-if="isToday(c.date) && nowTop !== null" class="now-line" :style="{ top: `${nowTop}px` }" aria-hidden="true">
            <span class="now-badge">{{ formatTimeOnly(now) }}</span>
          </div>

          <button
            v-for="item in c.items"
            :key="`${item.event.uid || item.event.summary}-${item.top}`"
            type="button"
            class="event"
            :class="{ compact: item.height < 44, 'event-ru': isRuEvent(item.event), 'event-cercle': isCercleEvent(item.event) }"
            :style="eventStyle(item)"
            :aria-label="eventLabel(item, c.date)"
            @click="emit('eventClick', item.event)"
          >
            <!-- Short slots (e.g. 1h): a single line "title · detail" -->
            <span v-if="item.height < 44" class="event-inline">
              <strong class="event-title">{{ eventTitle(item.event) }}</strong>
              <span v-if="eventDetail(item)" class="event-sub"> · {{ eventDetail(item) }}</span>
            </span>
            <template v-else>
              <strong class="event-title">{{ eventTitle(item.event) }}</strong>
              <span v-if="eventDetail(item)" class="event-line">{{ eventDetail(item) }}</span>
              <span v-if="!isRuEvent(item.event) && item.height >= 64 && item.event.location" class="event-line">{{ item.event.location }}</span>
            </template>
          </button>

          <p v-if="!c.items.length && !c.allDay.length" class="empty-day">Pas de cours</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.planning-grid {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.grid-toolbar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  min-height: 40px;
}

.period-btn {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  color: rgb(var(--v-theme-on-surface));
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 6px 4px;
  border-radius: 10px;
  cursor: pointer;
}

.date-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.span-toggle {
  display: flex;
  padding: 3px;
  margin-left: 4px;
  border-radius: 999px;
  background: rgb(var(--v-theme-surface-container-high));
}

.span-btn {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.span-btn.active {
  background: #1e3a8a;
  color: #fff;
}

.day-chips {
  display: flex;
  gap: 4px;
  padding: 2px 0 6px;
}

.day-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0;
  border: 0;
  background: none;
  font: inherit;
  border-radius: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.day-chip .dow {
  font-size: 0.68rem;
  text-transform: uppercase;
}

.day-chip .num {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.day-chip.active {
  background: rgba(37, 99, 235, 0.12);
  color: #1e3a8a;
}

.day-chip.today .num {
  color: #2563eb;
}

.next-course-hint {
  margin: 0 0 8px;
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.1);
  color: #1e3a8a;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

/* One scroll container for both axes: horizontal snap per day/week, vertical hours. */
.grid-scroller {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-left: var(--rail);
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-outline-variant));
}

.grid-scroller::-webkit-scrollbar {
  display: none;
}

.rail {
  position: sticky;
  left: 0;
  z-index: 4;
  flex: 0 0 var(--rail);
  background: rgb(var(--v-theme-surface));
}

.rail-corner {
  position: sticky;
  top: 0;
  height: var(--head-h, 52px);
  background: rgb(var(--v-theme-surface));
  z-index: 5;
}

.rail-hours {
  position: relative;
  height: var(--grid-h);
  margin-top: 8px;
}

.hour {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  font-size: 0.68rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.day-col {
  flex: 0 0 calc((100% - var(--rail)) / var(--per-page));
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}

/* Snap on every day in 1-day view, only on Mondays in 5-day view. */
.mode-day .day-col,
.mode-week .day-col.week-start {
  scroll-snap-align: start;
}

.day-head {
  position: sticky;
  top: 0;
  z-index: 3;
  /* Fixed height shared by all columns (flex items never shrink below their
     content by default, which would shift this column's hours). */
  flex: 0 0 var(--head-h, 52px);
  height: var(--head-h, 52px);
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

.day-head.empty {
  padding: 0;
  border-bottom: 0;
}

.day-date {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  padding: 2px 0;
  border-radius: 10px;
}

button.day-date {
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  button.day-date:hover {
    background: rgba(37, 99, 235, 0.08);
  }
}

.day-head .dow {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
}

.day-head .num {
  font-weight: 700;
}

.day-head .num.today {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
}

.allday {
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  box-shadow: inset 3px 0 0 var(--accent);
  padding: 3px 8px;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: left;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.day-body {
  position: relative;
  height: var(--grid-h);
  margin: 8px 0;
}

.day-col.today .day-body {
  background: rgba(37, 99, 235, 0.03);
}

.hour-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
  opacity: 0.55;
}

.now-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgb(var(--v-theme-error));
  z-index: 2;
}

.now-badge {
  position: absolute;
  left: 2px;
  top: -9px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
  background: rgb(var(--v-theme-error));
}

.event {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px 7px 5px 9px;
  border: 0;
  border-radius: 12px;
  box-shadow: inset 4px 0 0 var(--accent), 0 1px 2px rgba(15, 23, 42, 0.08);
  font: inherit;
  font-size: 0.76rem;
  line-height: 1.25;
  text-align: left;
  overflow: hidden;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.event.compact {
  padding-top: 2px;
  padding-bottom: 2px;
}

.event-title {
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Narrow 5-day columns: let the time wrap rather than cutting it, tighter padding. */
.mode-week .event-line {
  white-space: normal;
}

.mode-week .event {
  padding-left: 7px;
  padding-right: 4px;
}

.event-inline {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-inline .event-title {
  display: inline;
}

.event-sub {
  font-size: 0.74rem;
  opacity: 0.9;
}

.empty-day {
  position: absolute;
  top: 35%;
  width: 100%;
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

@media (hover: hover) and (pointer: fine) {
  .event:hover {
    filter: brightness(0.97);
  }
}
</style>

<style>
/* Dark theme accents (unscoped: see AppNav). */
.v-theme--dark .planning-grid .span-btn.active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.v-theme--dark .planning-grid .day-chip.active {
  background: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-primary));
}

.v-theme--dark .planning-grid .day-chip.today .num,
.v-theme--dark .planning-grid .next-course-hint {
  color: rgb(var(--v-theme-primary));
}

.v-theme--dark .planning-grid .next-course-hint {
  background: rgba(var(--v-theme-primary), 0.14);
}
</style>
