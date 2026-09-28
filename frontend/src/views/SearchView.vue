<script setup>
import { computed, inject } from "vue";
import ScheduleControls from "../components/ScheduleControls.vue";
import FavoritesBar from "../components/FavoritesBar.vue";

// Search screen: pick any schedule (promo, personal ADE, teacher, room) or a
// favorite. Choosing one opens it on the Planning screen.
const schedule = inject("schedule");
const openPersonalSchedule = inject("openPersonalSchedule");

const currentKey = computed(() => {
  const s = schedule;
  if (s.selectedMode === "personal") return "personal_edt";
  if (s.selectedMode === "teacher" && s.selectedTeacher) return `teacher_${s.selectedTeacher}`;
  if (s.selectedMode === "room" && s.selectedRoom) return `room_${s.selectedRoom}`;
  if (s.selectedMode === "student" && s.selectedFile) return `file_${s.selectedFile}`;
  return "";
});

// Loaders switch the mode themselves (and navigate to the Planning screen).
const onSelectFavorite = (fav) => {
  if (fav.mode === "personal") schedule.setMode("personal");
  else if (fav.mode === "student") schedule.loadSchedule(fav.file);
  else if (fav.mode === "teacher") schedule.loadTeacherSchedule(fav.teacher);
  else if (fav.mode === "room") schedule.loadRoomSchedule(fav.room);
};
</script>

<template>
  <div class="screen container">
    <FavoritesBar :current-key="currentKey" @select="onSelectFavorite" />
    <ScheduleControls :schedule="schedule" :show-actions="false" @open-personal-schedule="openPersonalSchedule" />
  </div>
</template>
