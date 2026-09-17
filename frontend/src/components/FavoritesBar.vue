<script setup>
import { useFavorites } from "../composables/useFavorites.js";

defineProps({
  currentKey: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["select"]);

const { favorites, removeFavorite } = useFavorites();

const selectFavorite = (fav) => {
  emit("select", fav);
};

const getFavIcon = (fav) => {
  if (fav.mode === "personal") return "⭐";
  if (fav.mode === "teacher") return "👨‍🏫";
  if (fav.mode === "room") return "🚪";
  return "🎓";
};
</script>

<template>
  <div v-if="favorites.length > 0" class="favorites-bar">
    <span class="favorites-label">Favoris :</span>
    <div class="fav-pills">
      <div
        v-for="fav in favorites"
        :key="fav.key"
        class="fav-pill"
        :class="{ active: fav.key === currentKey }"
        @click="selectFavorite(fav)"
      >
        <span class="fav-icon">{{ getFavIcon(fav) }}</span>
        <span class="fav-name">{{ fav.label }}</span>
        <button
          class="fav-remove"
          type="button"
          aria-label="Supprimer des favoris"
          @click.stop="removeFavorite(fav.key)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.favorites-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.favorites-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.fav-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.fav-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.3rem 0.2rem 0.65rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 9999px;
  font-size: 0.85rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  transition: all 0.15s ease;
}

.fav-pill.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.fav-remove {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.15rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  border-radius: 9999px;
  cursor: pointer;
  opacity: 0.65;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

@media (hover: hover) and (pointer: fine) {
  .fav-pill:hover {
    border-color: var(--accent);
  }

  .fav-remove:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.08);
  }
}
</style>
