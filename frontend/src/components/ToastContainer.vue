<script setup>
import { computed } from "vue";
import { mdiCheckCircle, mdiAlertCircle, mdiClose } from "@mdi/js";
import { useToast } from "../composables/useToast.js";

// Material 3 snackbars: bottom of the screen, above the tab bar. Only the two
// most recent are shown so they never cover the planning.
const { toasts, removeToast } = useToast();
const visible = computed(() => toasts.value.slice(-2));

const handleAction = (toast) => {
  if (typeof toast.action?.onClick === "function") toast.action.onClick();
  removeToast(toast.id);
};
</script>

<template>
  <div class="toast-container" aria-live="polite" aria-atomic="true">
    <transition-group name="toast">
      <div
        v-for="toast in visible"
        :key="toast.id"
        class="toast-item"
        :class="`toast-${toast.type}`"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <v-icon v-if="toast.type === 'success'" :icon="mdiCheckCircle" size="20" class="toast-icon" />
        <v-icon v-else-if="toast.type === 'error'" :icon="mdiAlertCircle" size="20" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button v-if="toast.action" type="button" class="toast-action" @click="handleAction(toast)">
          {{ toast.action.label }}
        </button>
        <button type="button" class="toast-close" aria-label="Fermer la notification" @click="removeToast(toast.id)">
          <v-icon :icon="mdiClose" size="18" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h) + 12px);
  z-index: 2500;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}

@media (min-width: 960px) {
  .toast-container {
    bottom: 24px;
    left: calc(50% + var(--rail-w) / 2);
  }
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 6px 6px 6px 16px;
  border-radius: 12px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  font-size: 0.92rem;
  line-height: 1.35;
  pointer-events: auto;
}

.toast-success .toast-icon {
  color: #4ade80;
}

.toast-error .toast-icon {
  color: #f87171;
}

.toast-message {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
}

.toast-action {
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-inverse-primary));
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.toast-close {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.8;
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
