import { defineStore } from "pinia";
import { ref } from "vue";
import { PERSONAL_CREDENTIALS_KEY } from "../utils/credentials.js";
import { readString, readJSON, write, remove, PERSONAL_CACHE_KEY, PERSONAL_META_KEY } from "./storage.js";

/**
 * The user's personal ADE schedule: its metadata, the cached ICS and the
 * (optionally) remembered credentials. Loading it into the planning is done
 * by the schedule store.
 */
export const usePersonalStore = defineStore("personal", () => {
  const personalScheduleInfo = ref(null);
  const rawPersonalIcs = ref("");

  const getCachedIcs = () => readString(PERSONAL_CACHE_KEY);
  const getCachedMeta = () => readJSON(PERSONAL_META_KEY, null);
  const getSavedCredentials = () => readJSON(PERSONAL_CREDENTIALS_KEY, null);
  const hasSavedCredentials = () => Boolean(readString(PERSONAL_CREDENTIALS_KEY));

  /**
   * Records a freshly loaded personal calendar and persists it for offline use.
   * Returns the full metadata. It never contains the login/password: this
   * object is persisted whatever the "remember me" choice.
   */
  const remember = (icsText, meta = {}) => {
    const previous = personalScheduleInfo.value || {};
    const fullMeta = {
      name: meta.name || previous.name || "Mon Planning ADE",
      universityId: meta.universityId || previous.universityId || "",
      universityName: meta.universityName || previous.universityName || "",
      resourceId: meta.resourceId || previous.resourceId || "",
      inputMode: meta.inputMode || previous.inputMode || "list",
      adeUrl: meta.adeUrl || previous.adeUrl || "",
      branchPath: meta.branchPath || previous.branchPath || [],
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    personalScheduleInfo.value = fullMeta;
    rawPersonalIcs.value = icsText;
    write(PERSONAL_CACHE_KEY, icsText);
    write(PERSONAL_META_KEY, fullMeta);
    return fullMeta;
  };

  /** Forgets everything about the personal schedule, including legacy keys. */
  const forget = () => {
    remove(
      PERSONAL_CREDENTIALS_KEY,
      PERSONAL_CACHE_KEY,
      PERSONAL_META_KEY,
      "personalAdeCredentials",
      "cachedPersonalIcs",
      "personalScheduleMeta"
    );
    personalScheduleInfo.value = null;
    rawPersonalIcs.value = "";
  };

  const downloadPersonalIcs = () => {
    const text = rawPersonalIcs.value || getCachedIcs();
    if (!text) return;

    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const baseName = (personalScheduleInfo.value?.name || "mon_planning_ade").toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${baseName}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  return {
    personalScheduleInfo,
    rawPersonalIcs,
    getCachedIcs,
    getCachedMeta,
    getSavedCredentials,
    hasSavedCredentials,
    remember,
    forget,
    downloadPersonalIcs,
  };
});
