<script setup>
import { computed, unref } from "vue";
import { getSubjectType, getSubjectColors } from "../utils/colors.js";
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

  const subjectList = Array.from(bySubject.values()).sort((a, b) => b.minutes - a.minutes);

  return {
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
      <span class="total-hours">📊 Total : <strong>{{ stats.totalHours }}h</strong></span>
      <span v-if="activeFilter" class="filter-active-notice">
        Filtre actif : <strong>{{ activeFilter }}</strong>
        <button class="clear-filter-btn" @click="emit('filter', activeFilter)">✕ Retirer</button>
      </span>
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
        :title="`Filtrer les cours ${sub.type}`"
        @click="emit('filter', sub.type)"
      >
        <span class="chip-label">{{ sub.type }}</span>
        <span class="chip-duration">{{ formatDuration(sub.minutes) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.week-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.total-hours strong {
  color: var(--text);
}

.filter-active-notice {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  background: rgba(37, 99, 235, 0.1);
  color: var(--accent);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.clear-filter-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.subject-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.chip.active {
  box-shadow: 0 0 0 2px var(--accent);
}

.chip-duration {
  opacity: 0.85;
  font-size: 0.75rem;
}
</style>
