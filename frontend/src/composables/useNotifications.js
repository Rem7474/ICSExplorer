import { ref } from "vue";

export function useNotifications() {
  const isSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const permission = ref(isSupported ? Notification.permission : "default");

  const requestPermission = async () => {
    if (!isSupported) return false;
    try {
      const res = await Notification.requestPermission();
      permission.value = res;
      return res === "granted";
    } catch {
      return false;
    }
  };

  return {
    isSupported,
    permission,
    requestPermission,
  };
}
