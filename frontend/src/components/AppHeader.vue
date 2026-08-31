<script setup>
import { computed } from "vue";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  health: {
    type: Object,
    default: null,
  },
  isPersonalActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["openPersonalSchedule"]);

const { isDark, toggleTheme } = useTheme();

const healthBadge = computed(() => {
  if (!props.health) return { text: "En ligne", class: "status-online" };
  if (props.health.status === "healthy") {
    return { text: "Synchronisé", class: "status-online", title: `Dernière synchro: ${props.health.last_sync_age || 'récente'}` };
  }
  return { text: "Synchro requise", class: "status-warning", title: props.health.errors?.join(", ") || "Synchronisation requise" };
});
</script>

<template>
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="brand-area">
          <div class="brand-title-row">
            <h1 class="brand-title">EDT Esisar</h1>
            <span class="status-pill" :class="healthBadge.class" :title="healthBadge.title">
              <span class="status-dot">●</span>
              {{ healthBadge.text }}
            </span>
          </div>
          <p class="brand-subtitle">
            Emplois du temps en direct, salles libres et plannings ADE.
          </p>
        </div>

        <div class="header-actions">
          <button
            class="theme-toggle-btn"
            type="button"
            :aria-label="isDark ? 'Basculer en mode clair' : 'Basculer en mode sombre'"
            :title="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
            @click="toggleTheme"
          >
            <span class="theme-icon">{{ isDark ? '☀️' : '🌙' }}</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  color: white;
  padding: 1.25rem 0;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07);
  transition: background 0.3s ease, border-color 0.3s ease;
}

:global(.dark-mode) .header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.brand-area {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.brand-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.brand-title {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.88;
  line-height: 1.3;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
}

.status-dot {
  font-size: 0.65rem;
  line-height: 1;
}

.status-online .status-dot {
  color: #34d399;
}

.status-warning .status-dot {
  color: #fbbf24;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.15rem;
  color: white;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.theme-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

:global(.dark-mode) .theme-toggle-btn {
  background: #334155;
  border-color: #475569;
}

:global(.dark-mode) .theme-toggle-btn:hover {
  background: #475569;
  border-color: #64748b;
}

@media (max-width: 640px) {
  .brand-title {
    font-size: 1.25rem;
  }
  .brand-subtitle {
    font-size: 0.82rem;
  }
}
</style>
