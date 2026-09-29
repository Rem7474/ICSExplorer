<script setup>
import { computed } from "vue";
import { PULL_THRESHOLD } from "../composables/usePullToRefresh.js";

// Material pull-to-refresh spinner: follows the finger, fills up to the
// threshold, then spins while refreshing.
const props = defineProps({
  distance: { type: Number, required: true },
  refreshing: { type: Boolean, default: false },
});

const progress = computed(() => Math.min(100, (props.distance / PULL_THRESHOLD) * 100));
const style = computed(() => ({
  transform: `translate(-50%, ${props.distance - 44}px) rotate(${progress.value * 2.7}deg)`,
  opacity: props.refreshing ? 1 : Math.min(1, props.distance / 40),
}));
</script>

<template>
  <div
    v-show="distance > 0 || refreshing"
    class="pull-indicator"
    :class="{ settling: !distance || refreshing }"
    :style="style"
    role="progressbar"
    :aria-label="refreshing ? 'Actualisation…' : 'Tirer pour actualiser'"
    :aria-busy="refreshing"
  >
    <v-progress-circular :model-value="progress" :indeterminate="refreshing" size="24" width="3" color="primary" />
  </div>
</template>

<style scoped>
.pull-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 20;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
  pointer-events: none;
}

.pull-indicator.settling {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
</style>
