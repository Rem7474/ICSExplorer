<script setup>
import { useFavorites } from "../composables/useFavorites.js";

const props = defineProps({
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
  padding: 0.25rem 0.6rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 9999px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.fav-pill:hover {
  border-color: var(--accent);
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
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
}

.fav-remove:hover {
  opacity: 1;
}
</style>
