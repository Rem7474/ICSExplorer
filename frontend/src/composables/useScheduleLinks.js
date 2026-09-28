import { computed, unref } from "vue";
import { fileUrl } from "../ics/api.js";
import { useToast } from "./useToast.js";

const copyToClipboard = async (text, successMessage, promptLabel) => {
  const { showToast } = useToast();
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, "success");
  } catch {
    prompt(promptLabel, text);
  }
};

/**
 * Links for the displayed schedule: its .ics feed (download, copy, webcal
 * subscription) and a shareable app link. `schedule` is the useSchedule()
 * facade (refs) or its reactive() version.
 */
export function useScheduleLinks(schedule) {
  // Promo and room calendars have a public .ics file; teacher and personal
  // schedules are built in the browser, so they have none.
  const canCopyIcsLink = computed(() => {
    const mode = unref(schedule.selectedMode);
    if (mode === "student") return Boolean(unref(schedule.selectedFile));
    if (mode === "room") return Boolean(unref(schedule.selectedRoom));
    return false;
  });

  const currentIcsUrl = computed(() => {
    const mode = unref(schedule.selectedMode);
    if (mode === "room") {
      const room = unref(schedule.selectedRoom);
      return room ? `/rooms/${encodeURIComponent(room)}.ics` : "#";
    }
    const file = unref(schedule.selectedFile);
    return file && typeof file === "string" ? fileUrl(file) : "#";
  });

  const absoluteIcsUrl = computed(() => {
    if (!canCopyIcsLink.value || currentIcsUrl.value === "#") return "";
    try {
      return new URL(currentIcsUrl.value, window.location.origin).href;
    } catch {
      return currentIcsUrl.value;
    }
  });

  // webcal:// lets calendar apps (Apple Calendar, Outlook, Thunderbird)
  // subscribe to the feed instead of importing a one-off copy.
  const webcalUrl = computed(() => absoluteIcsUrl.value.replace(/^https?:/, "webcal:"));

  // Link to the Planning screen showing this schedule (works from any tab).
  const shareUrl = computed(() => {
    const query = unref(schedule.scheduleQuery);
    if (!query || !Object.keys(query).length) return window.location.href;
    return `${window.location.origin}/?${new URLSearchParams(query)}`;
  });

  const copyIcsLink = () => {
    if (!absoluteIcsUrl.value) return;
    return copyToClipboard(absoluteIcsUrl.value, "Lien du calendrier (.ics) copié !", "Copiez ce lien du calendrier :");
  };

  const copyShareLink = () => copyToClipboard(shareUrl.value, "Lien de partage copié dans le presse-papier !", "Copiez ce lien :");

  return { canCopyIcsLink, currentIcsUrl, absoluteIcsUrl, webcalUrl, shareUrl, copyIcsLink, copyShareLink };
}
