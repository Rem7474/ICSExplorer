<script setup>
// Throwaway prototype (phase 0 spike): Vuetify 4 / Material 3 app shell around
// a planning grid built on native browser scrolling (scroll-snap + sticky).
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useTheme as useVuetifyTheme } from "vuetify";
import {
  mdiCalendarToday, mdiCalendarTodayOutline, mdiMagnify, mdiDoorOpen, mdiDoor,
  mdiDotsHorizontalCircle, mdiDotsHorizontalCircleOutline, mdiStarOutline,
  mdiCalendarCursor, mdiClockOutline, mdiMapMarkerOutline, mdiAccountOutline,
  mdiCalendarPlus, mdiWeatherNight, mdiWhiteBalanceSunny,
} from "@mdi/js";
import { fetchFileList, fetchIcsText } from "../ics/api.js";
import { parseIcs, extractTeacherNames } from "../ics/parser.js";
import { getRelevantWeekStart, formatTimeOnly } from "../utils/dates.js";
import { getSubjectColors } from "../utils/colors.js";
import { buildSingleEventIcs } from "../utils/icsExport.js";
import { isIOS } from "./vuetify.js";

const theme = useVuetifyTheme();
const isDark = computed(() => theme.global.current.value.dark);
const toggleTheme = () => theme.change(isDark.value ? "light" : "dark");

const HOUR_START = 8;
const GRID_PAD = 10;
const HOUR_END = 19;
const PX_PER_HOUR = 64;
const RAIL = 44;

const nav = ref("planning");
// Filled icon when active, outlined otherwise (Material 3 / iOS tab bar convention).
const navItems = [
  { value: "planning", label: "Planning", icon: mdiCalendarTodayOutline, active: mdiCalendarToday },
  { value: "search", label: "Rechercher", icon: mdiMagnify, active: mdiMagnify },
  { value: "rooms", label: "Salles libres", icon: mdiDoor, active: mdiDoorOpen },
  { value: "more", label: "Plus", icon: mdiDotsHorizontalCircleOutline, active: mdiDotsHorizontalCircle },
];

// Colored course cards: tinted fill, strong accent bar, title in the subject hue.
const eventStyle = (item) => {
  const accent = getSubjectColors(item.ev, isDark.value).border;
  const surface = "rgb(var(--v-theme-surface))";
  const ink = "rgb(var(--v-theme-on-surface))";
  return {
    top: `${item.top}px`,
    height: `${item.height}px`,
    left: item.left,
    width: item.width,
    "--accent": accent,
    background: `color-mix(in srgb, ${accent} ${isDark.value ? 30 : 17}%, ${surface})`,
    color: `color-mix(in srgb, ${accent} ${isDark.value ? 25 : 55}%, ${ink})`,
  };
};
const daysPerPage = ref(1);
const fileName = ref("");
const events = ref([]);
const weekStart = ref(new Date());
const pager = ref(null);
const activeDay = ref(0);
const sheet = ref(false);
const selected = ref(null);

const days = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const date = new Date(weekStart.value);
    date.setDate(date.getDate() + i);
    const dayEvents = events.value.filter((e) => new Date(e.start).toDateString() === date.toDateString());
    return { date, events: layout(dayEvents) };
  })
);

// Overlap layout: events sharing time get side-by-side columns (same idea as ScheduleWeek).
function layout(list) {
  const items = list
    .map((ev) => ({ ev, s: new Date(ev.start), e: new Date(ev.end) }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(0); }
      cols[c] = it.e;
      it.col = c;
    }
    cluster.forEach((it) => out.push({ ...it, cols: cols.length }));
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out.map(({ ev, s, e, col, cols }) => ({
    ev,
    top: GRID_PAD + (s.getHours() + s.getMinutes() / 60 - HOUR_START) * PX_PER_HOUR,
    height: Math.max(28, ((e - s) / 3600000) * PX_PER_HOUR - 2),
    left: `${(col / cols) * 100}%`,
    width: `calc(${100 / cols}% - 4px)`,
    time: `${formatTimeOnly(s)} – ${formatTimeOnly(e)}`,
  }));
}

const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const gridHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR + 2 * GRID_PAD;

const now = ref(new Date());
const nowTop = computed(() => GRID_PAD + (now.value.getHours() + now.value.getMinutes() / 60 - HOUR_START) * PX_PER_HOUR);
const isToday = (d) => d.toDateString() === now.value.toDateString();

const weekLabel = computed(() =>
  weekStart.value.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
);

const dayWidth = computed(() => `calc((100% - ${RAIL}px) / ${daysPerPage.value})`);

const scrollToDay = (idx, behavior = "smooth") => {
  const el = pager.value?.querySelector(`[data-day="${idx}"]`);
  if (el) pager.value.scrollTo({ left: el.offsetLeft - RAIL, behavior });
};

const onPagerScroll = () => {
  const el = pager.value;
  if (!el) return;
  const colW = (el.clientWidth - RAIL) / daysPerPage.value;
  activeDay.value = Math.min(4, Math.max(0, Math.round(el.scrollLeft / colW)));
};

watch(daysPerPage, () => nextTick(() => scrollToDay(activeDay.value, "auto")));

const openEvent = (ev) => {
  selected.value = ev;
  sheet.value = true;
};

const teachers = computed(() => (selected.value ? extractTeacherNames(selected.value.description || "") : []));

const addToCalendar = () => {
  const blob = new Blob([buildSingleEventIcs(selected.value)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cours.ics";
  a.click();
  URL.revokeObjectURL(a.href);
};

onMounted(async () => {
  const params = new URLSearchParams(location.search);
  const files = await fetchFileList();
  fileName.value = params.get("file") || files[0];
  events.value = parseIcs(await fetchIcsText(fileName.value));
  weekStart.value = getRelevantWeekStart(events.value);
  await nextTick();
  const todayIdx = days.value.findIndex((d) => isToday(d.date));
  const firstWithEvents = days.value.findIndex((d) => d.events.length);
  scrollToDay(todayIdx >= 0 ? todayIdx : Math.max(0, firstWithEvents), "auto");
  // Open the day on the current hour (or 8h).
  pager.value.scrollTop = Math.max(0, (todayIdx >= 0 ? nowTop.value : 0) - 80);
  setInterval(() => (now.value = new Date()), 30000);
});
</script>

<template>
  <v-app :class="{ 'is-ios': isIOS }">
    <v-app-bar class="app-bar-safe brand-bar" flat>
      <v-app-bar-title>
        <div class="bar-title">{{ fileName.replace(/\.ics$/, "") || "ICSExplorer" }}</div>
        <div class="bar-subtitle">Semaine du {{ weekLabel }}</div>
      </v-app-bar-title>
      <template #append>
        <v-btn :icon="mdiCalendarCursor" color="white" aria-label="Aujourd'hui" @click="scrollToDay(Math.max(0, days.findIndex((d) => isToday(d.date))))" />
        <v-btn :icon="mdiStarOutline" color="white" aria-label="Épingler" />
        <v-btn :icon="isDark ? mdiWhiteBalanceSunny : mdiWeatherNight" color="white" aria-label="Changer de thème" @click="toggleTheme" />
      </template>
    </v-app-bar>

    <v-main class="main-fill">
      <div class="day-strip">
        <div class="day-chips" role="tablist" aria-label="Jour affiché">
          <button
            v-for="(d, i) in days"
            :key="i"
            class="day-chip ios-press"
            :class="{ active: i >= activeDay && i < activeDay + daysPerPage, today: isToday(d.date) }"
            role="tab"
            :aria-selected="i === activeDay"
            @click="scrollToDay(i)"
          >
            <span class="dow">{{ d.date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "") }}</span>
            <span class="num">{{ d.date.getDate() }}</span>
          </button>
        </div>
        <div class="span-toggle" role="group" aria-label="Nombre de jours affichés">
          <button
            v-for="n in [1, 3, 5]"
            :key="n"
            class="span-btn ios-press"
            :class="{ active: daysPerPage === n }"
            :aria-pressed="daysPerPage === n"
            @click="daysPerPage = n"
          >
            {{ n }}J
          </button>
        </div>
      </div>

      <!-- Native planning: one scroll container, horizontal snap per day, sticky hour rail. -->
      <div ref="pager" class="pager" :style="{ '--day-w': dayWidth, '--rail': `${RAIL}px` }" @scroll.passive="onPagerScroll">
        <div class="rail" :style="{ height: `${gridHeight}px` }" aria-hidden="true">
          <span v-for="h in hours" :key="h" class="hour" :style="{ top: `${GRID_PAD + (h - HOUR_START) * PX_PER_HOUR}px` }">{{ h }}h</span>
        </div>
        <section
          v-for="(d, i) in days"
          :key="i"
          class="day"
          :data-day="i"
          :aria-label="d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })"
          :style="{ height: `${gridHeight}px` }"
        >
          <div v-for="h in hours" :key="h" class="hour-line" :style="{ top: `${GRID_PAD + (h - HOUR_START) * PX_PER_HOUR}px` }" />
          <div v-if="isToday(d.date)" class="now-line" :style="{ top: `${nowTop}px` }" aria-hidden="true" />
          <button
            v-for="item in d.events"
            :key="item.ev.uid + item.top"
            class="event ios-press"
            :style="eventStyle(item)"
            :aria-label="`${item.ev.summary}, ${item.time}${item.ev.location ? ', salle ' + item.ev.location : ''}`"
            @click="openEvent(item.ev)"
          >
            <strong>{{ item.ev.summary }}</strong>
            <span v-if="item.height > 44">{{ item.time }}</span>
            <span v-if="item.height > 64 && item.ev.location">{{ item.ev.location }}</span>
          </button>
          <p v-if="!d.events.length" class="empty-day">Pas de cours</p>
        </section>
      </div>
    </v-main>

    <nav class="tab-bar" aria-label="Navigation principale">
      <button
        v-for="item in navItems"
        :key="item.value"
        class="tab-item ios-press"
        :class="{ active: nav === item.value }"
        :aria-current="nav === item.value ? 'page' : undefined"
        @click="nav = item.value"
      >
        <span class="tab-indicator"><v-icon :icon="nav === item.value ? item.active : item.icon" size="24" /></span>
        <span class="tab-label">{{ item.label }}</span>
      </button>
    </nav>

    <v-bottom-sheet v-model="sheet">
      <v-card v-if="selected" class="sheet-card">
        <div class="grabber" aria-hidden="true" />
        <v-card-title class="text-wrap">{{ selected.summary }}</v-card-title>
        <v-list density="comfortable" bg-color="transparent">
          <v-list-item :prepend-icon="mdiClockOutline" :title="`${formatTimeOnly(selected.start)} – ${formatTimeOnly(selected.end)}`" :subtitle="new Date(selected.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })" />
          <v-list-item v-if="selected.location" :prepend-icon="mdiMapMarkerOutline" :title="selected.location" subtitle="Voir le planning de la salle" link />
          <v-list-item v-for="t in teachers" :key="t" :prepend-icon="mdiAccountOutline" :title="t" subtitle="Voir le planning de l'enseignant" link />
        </v-list>
        <v-card-actions class="sheet-actions">
          <v-btn variant="tonal" :prepend-icon="mdiCalendarPlus" @click="addToCalendar">Ajouter au calendrier</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="sheet = false">Fermer</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>
  </v-app>
</template>

<style>
:root {
  /* iOS / system font instead of Roboto (no web font download either). */
  --v-font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif;
  --v-font-heading: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
}

html,
body {
  overflow: hidden; /* app shell: only the planning scrolls */
  overscroll-behavior: none;
}

/* Subject colors shared with the current app (see styles/main.css). */
.v-theme--light {
  --color-IN: rgba(99, 102, 241, 0.12); --border-IN: #6366f1;
  --color-TE: rgba(245, 158, 11, 0.12); --border-TE: #f59e0b;
  --color-SN: rgba(14, 165, 233, 0.12); --border-SN: #0ea5e9;
  --color-PR: rgba(244, 63, 94, 0.12); --border-PR: #f43f5e;
  --color-MT: rgba(244, 63, 94, 0.12); --border-MT: #f43f5e;
  --color-LV: rgba(6, 182, 212, 0.12); --border-LV: #06b6d4;
  --color-XP: rgba(168, 85, 247, 0.12); --border-XP: #a855f7;
  --color-AU: rgba(249, 115, 22, 0.12); --border-AU: #f97316;
  --color-EP: rgba(59, 130, 246, 0.12); --border-EP: #3b82f6;
  --color-MAC: rgba(16, 185, 129, 0.12); --border-MAC: #10b981;
  --color-SP: rgba(236, 72, 153, 0.12); --border-SP: #ec4899;
  --color-PT: rgba(20, 184, 166, 0.12); --border-PT: #14b8a6;
  --color-HU: rgba(168, 85, 247, 0.12); --border-HU: #a855f7;
}

.v-theme--dark {
  --color-IN: rgba(99, 102, 241, 0.18); --border-IN: #818cf8;
  --color-TE: rgba(245, 158, 11, 0.18); --border-TE: #fbbf24;
  --color-SN: rgba(14, 165, 233, 0.18); --border-SN: #38bdf8;
  --color-PR: rgba(244, 63, 94, 0.18); --border-PR: #fb7185;
  --color-MT: rgba(244, 63, 94, 0.18); --border-MT: #fb7185;
  --color-LV: rgba(6, 182, 212, 0.18); --border-LV: #22d3ee;
  --color-XP: rgba(168, 85, 247, 0.18); --border-XP: #c084fc;
  --color-AU: rgba(249, 115, 22, 0.18); --border-AU: #fb923c;
  --color-EP: rgba(59, 130, 246, 0.18); --border-EP: #60a5fa;
  --color-MAC: rgba(16, 185, 129, 0.18); --border-MAC: #34d399;
  --color-SP: rgba(236, 72, 153, 0.18); --border-SP: #f472b6;
  --color-PT: rgba(20, 184, 166, 0.18); --border-PT: #2dd4bf;
  --color-HU: rgba(168, 85, 247, 0.18); --border-HU: #c084fc;
}

button.day-chip {
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}

/* Safe areas: notch / Dynamic Island at the top, home indicator at the bottom. */
.app-bar-safe {
  padding-top: env(safe-area-inset-top);
}

/* Brand header: same blue gradient as the current app, deeper in dark mode. */
.brand-bar.v-app-bar {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
  color: #fff !important;
}

.v-theme--dark .brand-bar.v-app-bar {
  background: linear-gradient(135deg, #0b1740 0%, #1e3a8a 100%) !important;
}

/* iOS pressed state replaces the Material ripple. */
.is-ios .ios-press:active,
.is-ios .v-btn:active {
  opacity: 0.55;
  transition: opacity 0s;
}
</style>

<style scoped>
.main-fill {
  --tab-h: calc(64px + env(safe-area-inset-bottom));
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--tab-h) !important;
  box-sizing: border-box;
}

.bar-title {
  font-weight: 600;
  font-size: 1.05rem;
  line-height: 1.2;
}

.bar-subtitle {
  font-size: 0.78rem;
  opacity: 0.7;
}

.day-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem 0.75rem;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  border-radius: 0 0 22px 22px;
  box-shadow: 0 6px 16px -8px rgba(30, 58, 138, 0.55);
  position: relative;
  z-index: 4;
}

.v-theme--dark .day-strip {
  background: linear-gradient(135deg, #0b1740 0%, #1e3a8a 100%);
  box-shadow: none;
}

.day-chips {
  display: flex;
  flex: 1;
  gap: 0.25rem;
}

.day-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.78);
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.day-chip .dow {
  font-size: 0.7rem;
  text-transform: uppercase;
}

.day-chip .num {
  font-weight: 700;
  font-size: 1rem;
}

.day-chip.active {
  background: #fff;
  color: #1e3a8a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.day-chip.today:not(.active) .num {
  color: #fde047;
}

.day-chip.today .num::after {
  content: "";
  display: block;
  width: 5px;
  height: 5px;
  margin: 2px auto 0;
  border-radius: 50%;
  background: currentColor;
}

.span-toggle {
  display: flex;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.span-btn {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
}

.span-btn.active {
  background: #fff;
  color: #1e3a8a;
}

.pager {
  position: relative;
  flex: 1;
  display: flex;
  overflow: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-left: var(--rail);
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  background: rgb(var(--v-theme-surface-container-lowest));
  margin-top: -14px; /* slide under the rounded header */
  padding-top: 14px;
  scrollbar-width: none; /* like iOS: no persistent scrollbars */
}

.pager::-webkit-scrollbar {
  display: none;
}

.rail {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: 0 0 var(--rail);
  background: rgb(var(--v-theme-surface-container-lowest));
}

.hour {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.day {
  position: relative;
  flex: 0 0 var(--day-w);
  scroll-snap-align: start;
  border-left: 1px solid rgb(var(--v-theme-outline-variant));
}

.hour-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
  opacity: 0.5;
}

.now-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgb(var(--v-theme-error));
  z-index: 2;
}

.event {
  position: absolute;
  margin-left: 2px;
  padding: 5px 7px 5px 9px;
  border: 0;
  border-radius: 12px;
  box-shadow: inset 4px 0 0 var(--accent), 0 1px 2px rgba(15, 23, 42, 0.08);
  text-align: left;
  font-size: 0.78rem;
  line-height: 1.25;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  -webkit-tap-highlight-color: transparent;
}

.event strong {
  font-size: 0.84rem;
  font-weight: 700;
}

.empty-day {
  position: absolute;
  top: 40%;
  width: 100%;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
}

/* Tab bar: translucent frosted glass (iOS), Material 3 pill indicator. */
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1004;
  display: flex;
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 6px 4px env(safe-area-inset-bottom);
  background: rgba(var(--v-theme-surface), 0.78);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid rgba(var(--v-theme-on-surface), 0.12);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: 0;
  background: none;
  font: inherit;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tab-indicator {
  display: grid;
  place-items: center;
  width: 60px;
  height: 30px;
  border-radius: 999px;
  transition: background-color 0.2s ease;
}

.tab-label {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.tab-item.active {
  color: #1e3a8a;
}

.tab-item.active .tab-indicator {
  background: rgba(37, 99, 235, 0.14);
}

.tab-item.active .tab-label {
  font-weight: 700;
}

.v-theme--dark .tab-item.active {
  color: rgb(var(--v-theme-primary));
}

.v-theme--dark .tab-item.active .tab-indicator {
  background: rgba(var(--v-theme-primary), 0.18);
}

.sheet-card {
  padding-bottom: env(safe-area-inset-bottom);
}

.grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  margin: 10px auto 2px;
  background: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.4;
}

.sheet-actions {
  padding: 0.5rem 1rem 1rem;
}
</style>
