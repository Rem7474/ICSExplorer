import { storeToRefs } from "pinia";
import { useCatalogStore } from "../stores/catalog.js";
import { useOverlaysStore } from "../stores/overlays.js";
import { usePersonalStore } from "../stores/personal.js";
import { useServerStore } from "../stores/server.js";
import { useStatusStore } from "../stores/status.js";
import { useScheduleStore } from "../stores/schedule.js";

export { DISABLED_SUBJECTS_KEY, SHOW_RU_MENU_KEY } from "../stores/storage.js";

/**
 * Facade over the Pinia stores, exposing the same shape as before the split
 * (refs + actions) so components can keep receiving a single `schedule`
 * object. New code should use the individual stores directly.
 */
export function useSchedule() {
  const catalog = useCatalogStore();
  const overlays = useOverlaysStore();
  const personal = usePersonalStore();
  const server = useServerStore();
  const status = useStatusStore();
  const schedule = useScheduleStore();

  const { availableFiles, availableTeachers, availableRooms, isAggregatorLoading, indexProgress } = storeToRefs(catalog);
  const { cercleEvents, ruEvents, showRuMenu } = storeToRefs(overlays);
  const { personalScheduleInfo, rawPersonalIcs } = storeToRefs(personal);
  const { serverHealth, isOnline, currentTime } = storeToRefs(server);
  const { statusMessage, statusAction } = storeToRefs(status);
  const {
    selectedMode, baseSchedule, selectedYear, selectedTrack, selectedType, selectedFile,
    selectedTeacher, selectedRoom, events, currentWeekStart, disabledSubjects, isLoading,
    activeModalEvent, isRoomModalOpen, selectedSubjectFilter, availableYears, availableTracks,
    availableTypes, availableRestFiles, currentWeekEnd, weekEvents, displayedWeekEvents, nextCourse,
  } = storeToRefs(schedule);

  // Background listeners: server health polling, connectivity, app clock and
  // browser Back/Forward.
  const startHealthPolling = (intervalMs) => {
    server.startHealthPolling(intervalMs);
    schedule.startHistoryListener();
  };
  const stopHealthPolling = () => {
    server.stopHealthPolling();
    schedule.stopHistoryListening();
  };

  return {
    // catalog
    availableFiles,
    availableTeachers,
    availableRooms,
    isAggregatorLoading,
    indexProgress,
    loadTeacherList: catalog.loadTeacherList,
    loadRoomList: catalog.loadRoomList,
    // overlays
    cercleEvents,
    ruEvents,
    showRuMenu,
    loadCercleEvents: overlays.loadCercleEvents,
    loadRuEvents: overlays.loadRuEvents,
    // personal schedule
    personalScheduleInfo,
    rawPersonalIcs,
    downloadPersonalIcs: personal.downloadPersonalIcs,
    // server
    serverHealth,
    isOnline,
    currentTime,
    checkHealth: server.checkHealth,
    startHealthPolling,
    stopHealthPolling,
    // status
    statusMessage,
    statusAction,
    // planning
    selectedMode,
    baseSchedule,
    selectedYear,
    selectedTrack,
    selectedType,
    selectedFile,
    selectedTeacher,
    selectedRoom,
    events,
    currentWeekStart,
    currentWeekEnd,
    weekEvents,
    displayedWeekEvents,
    nextCourse,
    disabledSubjects,
    selectedSubjectFilter,
    isLoading,
    activeModalEvent,
    isRoomModalOpen,
    availableYears,
    availableTracks,
    availableTypes,
    availableRestFiles,
    init: schedule.init,
    setMode: schedule.setMode,
    returnToBaseSchedule: schedule.returnToBaseSchedule,
    loadSchedule: schedule.loadSchedule,
    loadPersonalEvents: schedule.loadPersonalEvents,
    loadTeacherSchedule: schedule.loadTeacherSchedule,
    loadRoomSchedule: schedule.loadRoomSchedule,
    refreshPersonalSchedule: schedule.refreshPersonalSchedule,
    clearPersonalSchedule: schedule.clearPersonalSchedule,
    reloadCurrentScheduleSilently: schedule.reloadCurrentScheduleSilently,
    toggleRuMenu: schedule.toggleRuMenu,
    toggleSubjectFilter: schedule.toggleSubjectFilter,
    resetSubjectFilters: schedule.resetSubjectFilters,
    loadSavedDisabledSubjects: schedule.loadSavedDisabledSubjects,
    saveDisabledSubjects: schedule.saveDisabledSubjects,
    getCurrentScheduleKey: schedule.getCurrentScheduleKey,
    nextWeek: schedule.nextWeek,
    prevWeek: schedule.prevWeek,
    goToCurrentWeek: schedule.goToCurrentWeek,
    openRoomModal: schedule.openRoomModal,
    closeRoomModal: schedule.closeRoomModal,
    openEventModal: schedule.openEventModal,
    closeEventModal: schedule.closeEventModal,
  };
}
