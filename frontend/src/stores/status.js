import { defineStore } from "pinia";
import { ref, watch } from "vue";

/** Status banner message and its optional call-to-action. */
export const useStatusStore = defineStore("status", () => {
  const statusMessage = ref("");
  // Optional call-to-action attached to the current status message
  // ("configure-personal"), so the UI never has to parse message text.
  const statusAction = ref(null);
  let statusActionMessage = "";

  const setStatus = (message, action = null) => {
    statusActionMessage = action ? message : "";
    statusAction.value = action;
    statusMessage.value = message;
  };

  watch(statusMessage, (msg) => {
    if (msg !== statusActionMessage) statusAction.value = null;
  });

  return { statusMessage, statusAction, setStatus };
});
