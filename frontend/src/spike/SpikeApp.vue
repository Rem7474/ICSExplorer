<script setup>
// Throwaway prototype (phase 0 spike): Vuetify 4 / Material 3 app shell around
// a planning grid built on native browser scrolling (scroll-snap + sticky).
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useTheme as useVuetifyTheme } from "vuetify";
import {
  mdiCalendarToday, mdiMagnify, mdiDoorOpen, mdiDotsHorizontal, mdiStarOutline,
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
    <v-app-bar color="surface-container" class="app-bar-safe">
      <v-app-bar-title>
        <div class="bar-title">{{ fileName.replace(/\.ics$/, "") || "ICSExplorer" }}</div>
        <div class="bar-subtitle">Semaine du {{ weekLabel }}</div>
      </v-app-bar-title>
      <template #append>
        <v-btn :icon="mdiCalendarCursor" aria-label="Aujourd'hui" @click="scrollToDay(Math.max(0, days.findIndex((d) => isToday(d.date))))" />
        <v-btn :icon="mdiStarOutline" aria-label="Épingler" />
        <v-btn :icon="isDark ? mdiWhiteBalanceSunny : mdiWeatherNight" aria-label="Changer de thème" @click="toggleTheme" />
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
        <v-btn-toggle v-model="daysPerPage" mandatory density="compact" divided variant="outlined" class="span-toggle">
          <v-btn :value="1" size="small">1J</v-btn>
          <v-btn :value="3" size="small">3J</v-btn>
          <v-btn :value="5" size="small">5J</v-btn>
        </v-btn-toggle>
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
            :style="{
              top: `${item.top}px`, height: `${item.height}px`, left: item.left, width: item.width,
              background: getSubjectColors(item.ev, isDark).background,
              borderColor: getSubjectColors(item.ev, isDark).border,
              color: getSubjectColors(item.ev, isDark).text,
            }"
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

    <v-bottom-navigation v-model="nav" grow color="primary" class="bottom-nav-safe">
      <v-btn value="planning"><v-icon :icon="mdiCalendarToday" /><span>Planning</span></v-btn>
      <v-btn value="search"><v-icon :icon="mdiMagnify" /><span>Rechercher</span></v-btn>
      <v-btn value="rooms"><v-icon :icon="mdiDoorOpen" /><span>Salles libres</span></v-btn>
      <v-btn value="more"><v-icon :icon="mdiDotsHorizontal" /><span>Plus</span></v-btn>
    </v-bottom-navigation>

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

.bottom-nav-safe {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(64px + env(safe-area-inset-bottom)) !important;
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
  height: 100dvh;
  display: flex;
  flex-direction: column;
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
  padding: 0.5rem 0.75rem;
  background: rgb(var(--v-theme-surface-container));
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
  color: rgb(var(--v-theme-on-surface-variant));
  -webkit-tap-highlight-color: transparent;
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
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.day-chip.today .num {
  color: rgb(var(--v-theme-primary));
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
  background: rgb(var(--v-theme-surface));
}

.rail {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: 0 0 var(--rail);
  background: rgb(var(--v-theme-surface));
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
  padding: 4px 6px;
  border-radius: 10px;
  border-left: 4px solid;
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
  font-size: 0.82rem;
}

.empty-day {
  position: absolute;
  top: 40%;
  width: 100%;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
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
