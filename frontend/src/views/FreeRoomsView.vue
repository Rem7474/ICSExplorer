<script setup>
import { inject } from "vue";
import FreeRoomsPanel from "../components/FreeRoomsPanel.vue";
import { useToast } from "../composables/useToast.js";

// Free rooms screen: rooms available at a given date/time; picking one opens
// its schedule on the Planning screen.
const schedule = inject("schedule");
const { showToast } = useToast();

const onSelectRoom = (room) => {
  schedule.loadRoomSchedule(room);
  showToast(`Planning de la salle ${room}`, "info");
};
</script>

<template>
  <div class="screen container">
    <section class="card">
      <FreeRoomsPanel inline @select-room="onSelectRoom" />
    </section>
  </div>
</template>
