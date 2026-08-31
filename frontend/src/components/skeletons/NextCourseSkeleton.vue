<template>
  <div class="next-course-skeleton card" aria-hidden="true">
    <div class="skeleton skeleton-heading"></div>
    <div class="skeleton-details">
      <div class="skeleton skeleton-line-large"></div>
      <div class="skeleton skeleton-line-small"></div>
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
