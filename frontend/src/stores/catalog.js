import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { fetchFileList, fetchRoomList } from "../ics/api.js";
import { getTeacherIndex, getRoomIndex } from "../ics/aggregator.js";

const byFrenchName = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" });
const byRoomName = (a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });

/** What can be browsed: promo files, and the teacher/room indexes built from them. */
export const useCatalogStore = defineStore("catalog", () => {
  const availableFiles = ref([]);
  const availableTeachers = ref([]);
  const availableRooms = ref([]);
  const isAggregatorLoading = ref(false);
  // Progress of the teacher/room index build ({ loaded, total }), null when idle.
  const indexProgress = ref(null);

  const onIndexProgress = (loaded, total) => {
    indexProgress.value = loaded >= total ? null : { loaded, total };
  };

  // Promo file names follow "{year}-{track}-{type}-{rest}.ics".
  const parsedFiles = computed(() =>
    availableFiles.value.map((fileName) => {
      const parts = fileName.replace(/\.ics$/i, "").split("-");
      return {
        fileName,
        year: parts[0] || "",
        track: parts[1] || "",
        type: parts[2] || "",
        rest: parts.slice(3).join("-"),
      };
    })
  );

  const findFile = (fileName) => parsedFiles.value.find((f) => f.fileName === fileName);

  const loadFiles = async () => {
    availableFiles.value = await fetchFileList();
    return availableFiles.value;
  };

  const loadTeacherList = async () => {
    if (availableTeachers.value.length > 0) return;
    isAggregatorLoading.value = true;
    try {
      const teacherMap = await getTeacherIndex(onIndexProgress);
      availableTeachers.value = Array.from(teacherMap.keys()).sort(byFrenchName);
    } catch {
      // Graceful degradation when offline or unindexed
    } finally {
      isAggregatorLoading.value = false;
      indexProgress.value = null;
    }
  };

  const loadRoomList = async () => {
    if (availableRooms.value.length > 0) return;
    isAggregatorLoading.value = true;
    try {
      const roomSet = new Set();

      // Fast path: static room files from /api/rooms
      try {
        (await fetchRoomList()).forEach((r) => roomSet.add(r));
        if (roomSet.size > 0) availableRooms.value = Array.from(roomSet).sort(byRoomName);
      } catch {}

      // Aggregated rooms from all parsed student calendars
      try {
        const roomMap = await getRoomIndex(onIndexProgress);
        for (const room of roomMap.keys()) roomSet.add(room);
      } catch {}

      availableRooms.value = Array.from(roomSet).sort(byRoomName);
    } catch {
      // Graceful degradation when offline or unindexed
    } finally {
      isAggregatorLoading.value = false;
      indexProgress.value = null;
    }
  };

  return {
    availableFiles,
    availableTeachers,
    availableRooms,
    isAggregatorLoading,
    indexProgress,
    parsedFiles,
    findFile,
    loadFiles,
    loadTeacherList,
    loadRoomList,
  };
});
