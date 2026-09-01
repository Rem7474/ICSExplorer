import { ref, watchEffect } from "vue";

const FAV_KEY = "edtFavorites";

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const favorites = ref(loadFavorites());

export function useFavorites() {
  watchEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites.value));
    } catch {}
  });

  const isFavorited = (item) => {
    return favorites.value.some((f) => f.key === item.key);
  };

  const toggleFavorite = (item) => {
    const idx = favorites.value.findIndex((f) => f.key === item.key);
    if (idx !== -1) {
      favorites.value.splice(idx, 1);
    } else {
      if (favorites.value.length >= 8) {
        favorites.value.shift(); // Max 8 favorites
      }
      favorites.value.push(item);
    }
  };

  const removeFavorite = (key) => {
    favorites.value = favorites.value.filter((f) => f.key !== key);
  };

  return {
    favorites,
    isFavorited,
    toggleFavorite,
    removeFavorite,
  };
}
