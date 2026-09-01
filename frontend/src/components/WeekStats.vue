<script setup>
import { computed, unref } from "vue";
import { getSubjectType, getSubjectColors, getSubjectFullName } from "../utils/colors.js";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  events: {
    type: [Array, Object],
    default: () => [],
  },
  activeFilter: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(["filter"]);

const { isDark } = useTheme();

const rawEvents = computed(() => {
  const evs = unref(props.events);
  return Array.isArray(evs) ? evs : [];
});

// Compute stats
const stats = computed(() => {
  let totalMinutes = 0;
  const bySubject = new Map();

  for (const ev of rawEvents.value) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const duration = (end - start) / (1000 * 60); // in minutes
    totalMinutes += duration;

    const summary = ev.summary || "Autre";
    const type = getSubjectType(summary);

    if (!bySubject.has(type)) {
      bySubject.set(type, { type, minutes: 0, count: 0 });
    }
    const item = bySubject.get(type);
    item.minutes += duration;
    item.count++;
  }

  const subjectList = Array.from(bySubject.values()).map((s) => ({
    ...s,
    fullName: getSubjectFullName(s.type),
    percentage: totalMinutes > 0 ? Math.round((s.minutes / totalMinutes) * 100) : 0,
  })).sort((a, b) => b.minutes - a.minutes);

  return {
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    subjects: subjectList,
  };
});

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
};
</script>

<template>
  <div v-if="rawEvents.length > 0" class="week-stats">
    <div class="stats-header">
      <span class="total-hours">📊 Total semaine : <strong>{{ stats.totalHours }}h</strong></span>
      <span v-if="activeFilter" class="filter-active-notice">
        Filtre : <strong>{{ getSubjectFullName(activeFilter) }} ({{ activeFilter }})</strong>
        <button class="clear-filter-btn" @click="emit('filter', activeFilter)">✕ Retirer</button>
      </span>
    </div>

    <!-- Segmented Distribution Bar -->
    <div v-if="stats.subjects.length > 0" class="distribution-bar" title="Répartition du temps de cours cette semaine">
      <div
        v-for="sub in stats.subjects"
        :key="sub.type"
        class="bar-segment"
        :style="{
          width: `${sub.percentage}%`,
          backgroundColor: getSubjectColors(sub.type, isDark).border,
        }"
        :title="`${sub.fullName} (${sub.type}) : ${formatDuration(sub.minutes)} (${sub.percentage}%)`"
      ></div>
    </div>

    <div class="subject-chips">
      <button
        v-for="sub in stats.subjects"
        :key="sub.type"
        type="button"
        class="chip"
        :class="{ active: activeFilter === sub.type }"
        :style="{
          backgroundColor: getSubjectColors(sub.type, isDark).background,
          borderColor: getSubjectColors(sub.type, isDark).border,
          color: getSubjectColors(sub.type, isDark).text,
        }"
        :title="`Filtrer les cours ${sub.fullName} (${sub.type}) - ${sub.percentage}% du temps`"
        @click="emit('filter', sub.type)"
      >
        <span class="chip-code">{{ sub.type }}</span>
        <span class="chip-label">{{ sub.fullName }}</span>
        <span class="chip-duration">{{ formatDuration(sub.minutes) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.week-stats {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.total-hours strong {
  color: var(--text);
  font-weight: 700;
}

.filter-active-notice {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-weight: 500;
}

.clear-filter-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.clear-filter-btn:hover {
  text-decoration: underline;
}

/* Distribution bar */
.distribution-bar {
  display: flex;
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
  background: var(--border);
  gap: 2px;
}

.bar-segment {
  height: 100%;
  transition: width 0.3s ease;
  min-width: 4px;
}

.bar-segment:hover {
  filter: brightness(1.15);
}

.subject-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
}

.chip.active {
  box-shadow: 0 0 0 2px var(--accent);
}

.chip-code {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  opacity: 0.8;
  background: rgba(0, 0, 0, 0.08);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.chip-duration {
  opacity: 0.9;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
