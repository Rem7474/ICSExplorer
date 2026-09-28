import { defineStore } from "pinia";
import { ref } from "vue";
import { useToast } from "../composables/useToast.js";

const HEALTH_CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const TIME_TICK_MS = 30 * 1000;

/** Server health/freshness, connectivity and the app clock. */
export const useServerStore = defineStore("server", () => {
  const { showToast } = useToast();

  const serverHealth = ref(null);
  const isOnline = ref(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const currentTime = ref(Date.now());

  let healthPollingTimer = null;
  let timeTickerTimer = null;
  let lastHealthCheckTime = 0;
  // Called when the server reports a new sync, so the displayed schedule can refresh.
  let syncListener = null;

  const onSync = (fn) => {
    syncListener = fn;
  };

  const checkHealth = async () => {
    lastHealthCheckTime = Date.now();
    try {
      if (typeof fetch === "function") {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res && (res.ok || res.status === 200 || res.status === 503)) {
          const data = await res.json();
          const prevSync = serverHealth.value?.last_sync;
          serverHealth.value = data;

          if (prevSync && data.last_sync && prevSync !== data.last_sync) {
            await syncListener?.();
          }
          return data;
        }
      }
    } catch {
      // Gracefully ignore network errors during background check
    }
    return null;
  };

  const handleVisibilityChange = async () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      // Check if more than 1 minute elapsed since last check
      if (Date.now() - lastHealthCheckTime >= 60 * 1000) {
        await checkHealth();
      }
    }
  };

  const handleOnline = async () => {
    isOnline.value = true;
    try {
      await checkHealth();
      showToast("Connexion rétablie", "info", 3000);
    } catch (err) {
      console.warn("Online sync error:", err);
    }
  };

  const handleOffline = () => {
    isOnline.value = false;
    showToast("Connexion perdue : mode hors-ligne actif", "info", 4000);
  };

  const stopTimeTicker = () => {
    if (timeTickerTimer) {
      clearInterval(timeTickerTimer);
      timeTickerTimer = null;
    }
  };

  const startTimeTicker = () => {
    stopTimeTicker();
    if (typeof setInterval === "function") {
      timeTickerTimer = setInterval(() => {
        currentTime.value = Date.now();
      }, TIME_TICK_MS);
    }
  };

  const stopHealthPolling = () => {
    if (healthPollingTimer) {
      clearInterval(healthPollingTimer);
      healthPollingTimer = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
    stopTimeTicker();
  };

  const startHealthPolling = (intervalMs = HEALTH_CHECK_INTERVAL_MS) => {
    stopHealthPolling();
    healthPollingTimer = setInterval(checkHealth, intervalMs);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    startTimeTicker();
  };

  return {
    serverHealth,
    isOnline,
    currentTime,
    onSync,
    checkHealth,
    startHealthPolling,
    stopHealthPolling,
  };
});
