<script setup>
import { computed } from "vue";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  health: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["openPersonalSchedule"]);

const { isDark, toggleTheme } = useTheme();

const healthBadge = computed(() => {
  if (!props.health) return { text: "En ligne", class: "status-online" };
  if (props.health.status === "healthy") {
    return { text: "Données à jour", class: "status-online", title: `Dernière synchro: ${props.health.last_sync_age || 'récente'}` };
  }
  return { text: "Données obsolètes", class: "status-warning", title: props.health.errors?.join(", ") || "Synchronisation requise" };
});
</script>

<template>
  <header class="header">
    <div class="container">
      <div class="header-top">
        <div class="title-area">
          <div class="title-row">
            <h1>EDT Esisar</h1>
            <span class="status-badge" :class="healthBadge.class" :title="healthBadge.title">
              {{ healthBadge.text }}
            </span>
          </div>
          <p>Emplois du temps en direct, salles libres et mode professeur.</p>
        </div>
        <div class="header-actions">
          <button
            class="personal-schedule-btn"
            type="button"
            @click="emit('openPersonalSchedule')"
          >
            🎓 Mon EDT personnel
          </button>
          <button
            class="theme-toggle"
            type="button"
            :aria-label="isDark ? 'Basculer en mode clair' : 'Basculer en mode sombre'"
            :title="isDark ? 'Mode clair' : 'Mode sombre'"
            @click="toggleTheme"
          >
            {{ isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: linear-gradient(120deg, var(--accent-dark), var(--accent));
  color: white;
  padding: 1.25rem 0 1.1rem;
  margin-bottom: 1.25rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.header p {
  margin: 0.25rem 0 0;
  opacity: 0.9;
  font-size: 0.95rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.status-online {
  background: rgba(16, 185, 129, 0.3);
  border-color: rgba(16, 185, 129, 0.6);
}

.status-warning {
  background: rgba(245, 158, 11, 0.3);
  border-color: rgba(245, 158, 11, 0.6);
}

.personal-schedule-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.15s ease;
  white-space: nowrap;
}

.personal-schedule-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.theme-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.15s ease;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
