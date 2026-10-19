<script setup>
// Live attendance of the RU (meals served / remaining) with today's curve and
// the daily totals of the previous days. Hidden when the backend has no data.
import { computed, onMounted, ref } from "vue";
import { fetchRuOccupancy } from "../../ics/api.js";

const props = defineProps({
  // Day of the selected meal: live figures only make sense for today.
  day: { type: [Date, String, Number], default: null },
});

const report = ref(null);

onMounted(async () => {
  report.value = await fetchRuOccupancy();
});

const isToday = computed(() => {
  if (!props.day) return true;
  const d = new Date(props.day);
  return !isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
});

const current = computed(() => (isToday.value ? report.value?.current : null));
const percent = computed(() => {
  const c = current.value;
  return c && c.capacity > 0 ? Math.min(100, Math.round((c.served / c.capacity) * 100)) : 0;
});
const color = computed(() => (percent.value >= 90 ? "error" : percent.value >= 70 ? "warning" : "success"));
const updatedAt = computed(() => {
  const d = current.value ? new Date(current.value.updatedAt) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
});

// --- Today's curve -----------------------------------------------------
const W = 300;
const H = 90;
const PAD = { l: 4, r: 4, t: 6, b: 6 };

const today = computed(() => (isToday.value ? report.value?.today || [] : []));
const curve = computed(() => {
  const pts = today.value
    .map((s) => ({ t: new Date(s.t).getTime(), served: s.served, capacity: s.capacity }))
    .filter((p) => !isNaN(p.t));
  if (pts.length < 2) return null;
  const cap = Math.max(...pts.map((p) => p.capacity), 1);
  const t0 = pts[0].t;
  const span = Math.max(pts[pts.length - 1].t - t0, 1);
  const x = (t) => PAD.l + ((t - t0) / span) * (W - PAD.l - PAD.r);
  const y = (v) => H - PAD.b - (v / cap) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.served).toFixed(1)}`).join(" ");
  const base = H - PAD.b;
  const area = `${line} L${x(pts[pts.length - 1].t).toFixed(1)},${base} L${x(t0).toFixed(1)},${base} Z`;
  const clock = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return { line, area, from: clock(t0), to: clock(pts[pts.length - 1].t) };
});

// --- Daily totals ------------------------------------------------------
const history = computed(() => report.value?.history || []);
// Attendance varies a lot from one weekday to another: one bar per service
// day, labelled with its weekday, with a gap between weeks.
const WEEKDAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
const HB = 110; // taller than the curve: room for value and weekday labels
const LABEL_TOP = 12;
const LABEL_BOTTOM = 14;
const WEEK_GAP = 0.8; // in bar slots

const mondayKey = (date) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toDateString();
};

const bars = computed(() => {
  const list = history.value;
  if (!list.length) return [];
  const max = Math.max(...list.map((d) => Math.max(d.served, d.capacity)), 1);
  const gaps = list.filter((d, i) => i > 0 && mondayKey(d.date) !== mondayKey(list[i - 1].date)).length;
  const slot = (W - PAD.l - PAD.r) / (list.length + gaps * WEEK_GAP);
  const barW = Math.max(Math.min(slot - 3, 16), 3);
  const plotH = HB - LABEL_TOP - LABEL_BOTTOM;
  let offset = 0;
  return list.map((d, i) => {
    if (i > 0 && mondayKey(d.date) !== mondayKey(list[i - 1].date)) offset += WEEK_GAP;
    const h = Math.max((d.served / max) * plotH, 1);
    const [yy, mm, dd] = d.date.split("-");
    const x = PAD.l + (i + offset) * slot + (slot - barW) / 2;
    return {
      key: d.date,
      x,
      cx: x + barW / 2,
      y: HB - LABEL_BOTTOM - h,
      w: barW,
      h,
      value: d.served,
      letter: WEEKDAY_LETTERS[new Date(`${d.date}T12:00:00`).getDay()],
      label: `${dd}/${mm}/${yy} : ${d.served} repas`,
    };
  });
});
const average = computed(() => {
  const list = history.value;
  return list.length ? Math.round(list.reduce((n, d) => n + d.served, 0) / list.length) : 0;
});

const visible = computed(() => Boolean(current.value) || bars.value.length > 0);
</script>

<template>
  <section v-if="visible" class="ru-occupancy" aria-label="Fréquentation du RU">
    <template v-if="current">
      <div class="head">
        <strong>Fréquentation du jour</strong>
        <span v-if="updatedAt" class="muted">mis à jour à {{ updatedAt }}</span>
      </div>
      <v-progress-linear
        :model-value="percent"
        :color="color"
        height="14"
        rounded
        :aria-label="`${percent}% de la capacité`"
      />
      <div class="counts">
        <span><strong>{{ current.served }}</strong> repas servis</span>
        <span><strong>{{ current.remaining }}</strong> restants</span>
        <span class="muted">sur {{ current.capacity }}</span>
      </div>
    </template>

    <figure v-if="curve" class="chart">
      <figcaption>Affluence aujourd'hui <span class="muted">({{ curve.from }} – {{ curve.to }})</span></figcaption>
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Courbe des repas servis aujourd'hui" preserveAspectRatio="none">
        <path :d="curve.area" class="area" />
        <path :d="curve.line" class="line" />
      </svg>
    </figure>

    <figure v-if="bars.length" class="chart">
      <figcaption>
        Repas servis par jour <span class="muted">(3 dernières semaines · moyenne {{ average }})</span>
      </figcaption>
      <svg :viewBox="`0 0 ${W} ${HB}`" role="img" aria-label="Repas servis par jour sur les trois dernières semaines" class="bars">
        <g v-for="b in bars" :key="b.key">
          <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="1.5" class="bar">
            <title>{{ b.label }}</title>
          </rect>
          <text :x="b.cx" :y="b.y - 3" class="val">{{ b.value }}</text>
          <text :x="b.cx" :y="HB - 3" class="day">{{ b.letter }}</text>
        </g>
      </svg>
    </figure>
  </section>
</template>

<style scoped>
.ru-occupancy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  margin: 4px 0 8px;
  border-radius: 12px;
  background: rgba(234, 88, 12, 0.06);
  font-size: 0.85rem;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.counts {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.muted {
  opacity: 0.65;
}

.chart {
  margin: 0;
}

.chart figcaption {
  margin-bottom: 4px;
}

.chart svg {
  display: block;
  width: 100%;
  height: 90px;
}

.chart svg.bars {
  height: auto;
}

.val,
.day {
  text-anchor: middle;
  fill: currentColor;
}

.val {
  font-size: 7px;
  opacity: 0.7;
}

.day {
  font-size: 8px;
  font-weight: 600;
}

.line {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.area {
  fill: rgb(var(--v-theme-primary));
  opacity: 0.15;
  stroke: none;
}

.bar {
  fill: rgb(var(--v-theme-primary));
  opacity: 0.8;
}
</style>
