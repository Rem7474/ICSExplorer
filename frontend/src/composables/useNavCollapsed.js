import { ref, watchEffect } from "vue";

const STORAGE_KEY = "nav-collapsed";

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

// Shared across components; only meaningful on large screens where the
// navigation is a drawer (it then shrinks to the icon rail).
const collapsed = ref(read());

watchEffect(() => {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("nav-collapsed", collapsed.value);
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.value ? "1" : "0");
  } catch {
    // Storage unavailable: the preference just isn't remembered.
  }
});

export function useNavCollapsed() {
  const toggle = () => {
    collapsed.value = !collapsed.value;
  };
  return { collapsed, toggle };
}
