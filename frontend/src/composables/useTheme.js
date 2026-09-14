import { ref, watchEffect } from "vue";

const THEME_KEY = "edt_theme";
const TOGGLE_COOLDOWN_MS = 350;

function getInitialTheme() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) {
        return saved === "dark";
      }
    }
  } catch {
    // Ignore localStorage access error (private mode / restricted cookies)
  }

  if (typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      // Ignore matchMedia error
    }
  }
  return false;
}

const isDark = ref(getInitialTheme());
let lastToggleTimestamp = 0;

function applyTheme(dark) {
  if (typeof document !== "undefined") {
    if (dark) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

// Reactively apply theme synchronously whenever isDark changes
if (typeof window !== "undefined") {
  applyTheme(isDark.value);
  watchEffect(
    () => {
      applyTheme(isDark.value);
    },
    { flush: "sync" }
  );
}

export function _resetThemeForTesting() {
  lastToggleTimestamp = 0;
}

export function useTheme() {
  const toggleTheme = () => {
    const now = Date.now();
    // Debounce/cooldown against ghost clicks and double taps on touchscreens
    if (now - lastToggleTimestamp < TOGGLE_COOLDOWN_MS) {
      return;
    }
    lastToggleTimestamp = now;
    isDark.value = !isDark.value;
  };

  return {
    isDark,
    toggleTheme,
  };
}

