<template>
  <div class="week-stats-skeleton" aria-hidden="true">
    <div class="skeleton skeleton-chip" v-for="i in 5" :key="i"></div>
  </div>
</template>

<style scoped>
.week-stats-skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.skeleton-chip {
  height: 28px;
  width: 80px;
  border-radius: 9999px;
}
</style>
