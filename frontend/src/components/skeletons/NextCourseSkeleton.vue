<script setup>
import Skeleton from "primevue/skeleton";
</script>

<template>
  <div class="next-course-skeleton card" aria-hidden="true">
    <Skeleton width="140px" height="20px" class="skeleton-heading" />
    <div class="skeleton-details">
      <Skeleton width="65%" height="28px" class="skeleton-line-large" />
      <Skeleton width="40%" height="18px" class="skeleton-line-small" />
    </div>
  </div>
</template>

<style scoped>
.next-course-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-heading {
  height: 20px;
  width: 140px;
}

.skeleton-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line-large {
  height: 28px;
  width: 65%;
}

.skeleton-line-small {
  height: 18px;
  width: 40%;
}
</style>
