<script setup>
import { onMounted, onUnmounted } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import FreeRoomsPanel from "./FreeRoomsPanel.vue";

const emit = defineEmits(["close", "selectRoom"]);

const handleKeydown = (e) => {
  if (e.key === "Escape") emit("close");
};

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

const onSelectRoom = (room) => {
  emit("selectRoom", room);
  emit("close");
};
</script>

<template>
  <Dialog
    :visible="true"
    modal
    :style="{ width: '92vw', maxWidth: '640px' }"
    :dismissable-mask="true"
    append-to="self"
    @update:visible="emit('close')"
  >
    <template #header>
      <div class="modal-header-custom">
        <h2>
          <i class="pi pi-building" style="margin-right: 0.5rem; color: var(--accent);" aria-hidden="true"></i>
          Salles vides en direct
        </h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">
          ✕
        </button>
      </div>
    </template>

    <FreeRoomsPanel @select-room="onSelectRoom" />

    <template #footer>
      <div class="modal-footer">
        <Button label="Fermer" severity="primary" size="small" @click="emit('close')" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.modal-header-custom h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: var(--muted);
  cursor: pointer;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
