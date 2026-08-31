<script setup>
import { onMounted, onUnmounted } from "vue";
import { formatDateTime, formatTimeOnly } from "../utils/dates.js";
import { isCercleEvent } from "../utils/colors.js";

const props = defineProps({
  event: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close"]);

const handleKeydown = (e) => {
  if (e.key === "Escape") {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const downloadSingleEvent = () => {
  if (!props.event) return;

  const formatDateToICS = (d) => {
    const date = new Date(d);
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EDT Esisar//FR",
    "BEGIN:VEVENT",
    `UID:${props.event.uid || Date.now()}`,
    `DTSTAMP:${formatDateToICS(new Date())}`,
    `DTSTART:${formatDateToICS(props.event.start)}`,
    `DTEND:${formatDateToICS(props.event.end)}`,
    `SUMMARY:${props.event.summary || "Cours"}`,
    props.event.location ? `LOCATION:${props.event.location}` : "",
    props.event.description ? `DESCRIPTION:${props.event.description.replace(/\n/g, "\\n")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.event.summary || "cours"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

const copyDetails = async () => {
  if (!props.event) return;
  const text = `${props.event.summary}\nDate: ${formatDateTime(props.event.start)} - ${formatTimeOnly(props.event.end)}\nLieu: ${props.event.location || 'N/A'}\n${props.event.description || ''}`;
  try {
    await navigator.clipboard.writeText(text);
    alert("Détails copiés !");
  } catch {}
};
</script>

<template>
  <div v-if="event" class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h2>{{ event.summary }}</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">
          ✕
        </button>
      </div>

      <div class="modal-body">
        <!-- Cercle source notice -->
        <div v-if="isCercleEvent(event)" class="cercle-source-banner">
          <span class="cercle-icon">🎉</span>
          <div class="cercle-info">
            <strong>Source : Cercle des Élèves</strong>
            <p>Cet événement associatif provient directement de l'agenda officiel du Cercle Esisar.</p>
          </div>
        </div>

        <div class="detail-row">
          <span class="detail-label">🕒 Horaire :</span>
          <span class="detail-value">
            {{ formatDateTime(event.start) }} - {{ formatTimeOnly(event.end) }}
          </span>
        </div>

        <div v-if="event.location" class="detail-row">
          <span class="detail-label">📍 Lieu :</span>
          <span class="detail-value">{{ event.location }}</span>
        </div>

        <div v-if="event.description" class="detail-row description-row">
          <span class="detail-label">📝 Détails :</span>
          <div class="detail-desc">
            <p v-for="(line, idx) in event.description.split('\n')" :key="idx">
              {{ line }}
            </p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" type="button" @click="copyDetails">
          📋 Copier
        </button>
        <button class="btn btn-outline" type="button" @click="downloadSingleEvent">
          📥 Ajouter au calendrier
        </button>
        <button class="btn btn-primary" type="button" @click="emit('close')">
          Fermer
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(540px, 100%);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
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

.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cercle-source-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(168, 85, 247, 0.12);
  border: 1px solid rgba(168, 85, 247, 0.35);
  color: #7e22ce;
  margin-bottom: 0.25rem;
}

:global(.dark-mode) .cercle-source-banner {
  background: rgba(168, 85, 247, 0.22);
  border-color: rgba(192, 132, 252, 0.4);
  color: #f3e8ff;
}

.cercle-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.cercle-info strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
}

.cercle-info p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.3;
  opacity: 0.9;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.detail-label {
  font-weight: 600;
  color: var(--muted);
  min-width: 90px;
}

.detail-value {
  color: var(--text);
}

.description-row {
  flex-direction: column;
}

.detail-desc {
  background: var(--bg);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.detail-desc p {
  margin: 0 0 0.25rem;
}

.detail-desc p:last-child {
  margin: 0;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
