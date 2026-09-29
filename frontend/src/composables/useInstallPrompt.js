import { ref, computed } from "vue";
import { isIOS } from "../plugins/vuetify.js";
import { readString, write } from "../stores/storage.js";

// Suggesting the installation: Chromium browsers (Android) hand us an
// install prompt; iOS has none, so we explain "Share → Add to Home Screen".
const VISITS_KEY = "edtVisits";
const DISMISSED_KEY = "edtInstallDismissedAt";
const SUGGEST_AFTER_VISITS = 2;
const SNOOZE_MS = 30 * 24 * 3600 * 1000;

const deferredPrompt = ref(null);
const installed = ref(false);
const sheetOpen = ref(false);

// Registered at import time: the event can fire before the app is mounted.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
    installed.value = false; // offered again (e.g. the app was uninstalled)
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt.value = null;
    installed.value = true;
    sheetOpen.value = false;
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export function useInstallPrompt() {
  const canPrompt = computed(() => Boolean(deferredPrompt.value));
  const needsIosGuide = computed(() => isIOS && !isStandalone());
  const available = computed(() => !installed.value && !isStandalone() && (canPrompt.value || needsIosGuide.value));

  /** Counts app launches (the suggestion waits for a returning user). */
  const recordVisit = () => write(VISITS_KEY, String((Number(readString(VISITS_KEY)) || 0) + 1));

  const shouldSuggest = () => {
    if (!available.value) return false;
    if ((Number(readString(VISITS_KEY)) || 0) < SUGGEST_AFTER_VISITS) return false;
    const dismissedAt = Number(readString(DISMISSED_KEY)) || 0;
    return Date.now() - dismissedAt > SNOOZE_MS;
  };

  const openSheet = () => (sheetOpen.value = true);

  const dismiss = () => {
    write(DISMISSED_KEY, String(Date.now()));
    sheetOpen.value = false;
  };

  /** Shows the browser's install dialog (Android/Chromium). Returns "accepted" | "dismissed" | "unavailable". */
  const install = async () => {
    const prompt = deferredPrompt.value;
    if (!prompt) return "unavailable";
    deferredPrompt.value = null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") sheetOpen.value = false;
    else write(DISMISSED_KEY, String(Date.now()));
    return outcome;
  };

  return { available, canPrompt, needsIosGuide, sheetOpen, recordVisit, shouldSuggest, openSheet, dismiss, install };
}
