import { ref, watchEffect } from "vue";

const THEME_KEY = "edt_theme";

function getInitialTheme() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    return saved === "dark";
  }
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

const isDark = ref(getInitialTheme());

export function useTheme() {
  watchEffect(() => {
    if (typeof document !== "undefined") {
      if (isDark.value) {
        document.documentElement.classList.add("dark-mode");
        if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, "dark");
      } else {
        document.documentElement.classList.remove("dark-mode");
        if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, "light");
      }
    }
  });

  const toggleTheme = () => {
    isDark.value = !isDark.value;
  };

  return {
    isDark,
    toggleTheme,
  };
}
