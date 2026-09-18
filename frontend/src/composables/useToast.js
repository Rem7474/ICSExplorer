import { ref } from "vue";

const toasts = ref([]);
let toastId = 0;

export function useToast() {
  const showToast = (message, type = "success", duration = 3000, action = null) => {
    const id = ++toastId;
    const toast = { id, message, type, action };
    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  };

  const removeToast = (id) => {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) {
      toasts.value.splice(idx, 1);
    }
  };

  return {
    toasts,
    showToast,
    removeToast,
  };
}
