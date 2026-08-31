<script setup>
import { computed, unref } from "vue";
import { formatTimeOnly, formatDateOnly } from "../utils/dates.js";
import { getSubjectColors, isCercleEvent } from "../utils/colors.js";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  course: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["click"]);

const { isDark } = useTheme();

const rawCourse = computed(() => unref(props.course));

const isCercle = computed(() => isCercleEvent(rawCourse.value));

const colors = computed(() => {
  const c = rawCourse.value;
  if (!c) return {};
  return getSubjectColors(c, isDark.value);
});

const timeDisplay = computed(() => {
  const c = rawCourse.value;
  if (!c) return "";
  return `${formatDateOnly(c.start)} à ${formatTimeOnly(c.start)} - ${formatTimeOnly(c.end)}`;
});
</script>

<template>
  <div
    v-if="rawCourse"
    class="card next-course-card"
    :style="{
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.text,
    }"
    @click="emit('click', rawCourse)"
  >
    <div class="next-course-header">
      <span v-if="isCercle" class="next-badge cercle-next-badge">🎉 PROCHAIN ÉVÉNEMENT • CERCLE ESISAR</span>
      <span v-else class="next-badge">PROCHAIN COURS</span>
      <span class="time-text">{{ timeDisplay }}</span>
    </div>
    <h3 class="course-title">{{ rawCourse.summary }}</h3>
    <p v-if="rawCourse.location" class="location-text">
      <strong>Lieu :</strong> {{ rawCourse.location }}
    </p>
  </div>
</template>

<style scoped>
.next-course-card {
  cursor: pointer;
  border-left-width: 6px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.next-course-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.next-course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.next-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.cercle-next-badge {
  background: rgba(147, 51, 234, 0.25);
  color: #7e22ce;
}

:global(.dark-mode) .cercle-next-badge {
  background: rgba(192, 132, 252, 0.35);
  color: #f3e8ff;
}

.course-title {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.time-text {
  font-size: 0.9rem;
  font-weight: 600;
}

.location-text {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.9;
}
</style>
