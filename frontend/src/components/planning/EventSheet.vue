<script setup>
// Course details: bottom sheet on phones, dialog on wide screens.
import { computed } from "vue";
import { useDisplay } from "vuetify";
import { VBottomSheet, VDialog } from "vuetify/components";
import {
  mdiClockOutline, mdiMapMarkerOutline, mdiAccountOutline, mdiAccountGroupOutline, mdiTextBoxOutline,
  mdiCalendarPlus, mdiContentCopy, mdiOpenInNew, mdiChevronRight,
} from "@mdi/js";
import { formatDateTime, formatTimeOnly, formatDateOnly, isAllDayEvent } from "../../utils/dates.js";
import { isCercleEvent, isRuEvent } from "../../utils/colors.js";
import { extractTeacherNames } from "../../ics/parser.js";
import { buildSingleEventIcs } from "../../utils/icsExport.js";
import { useToast } from "../../composables/useToast.js";
import { vSwipeDismiss } from "../../composables/swipeDismiss.js";

const props = defineProps({
  event: { type: Object, default: null },
});
const emit = defineEmits(["close", "selectTeacher", "selectRoom"]);

const { smAndDown } = useDisplay();
const { showToast } = useToast();

const open = computed({
  get: () => Boolean(props.event),
  set: (value) => {
    if (!value) emit("close");
  },
});

const schedule = computed(() => {
  const ev = props.event;
  if (!ev?.start || !ev?.end) return "";
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const sameDay = formatDateOnly(s) === formatDateOnly(e);
  if (isAllDayEvent(ev)) {
    return sameDay ? `Le ${formatDateOnly(s)} (toute la journée)` : `Du ${formatDateOnly(s)} au ${formatDateOnly(e)} (toute la journée)`;
  }
  return sameDay ? `${formatDateTime(s)} - ${formatTimeOnly(e)}` : `Du ${formatDateTime(s)} au ${formatDateTime(e)}`;
});

const rooms = computed(() =>
  (props.event?.location || "")
    .split(/[,;/]/)
    .map((r) => r.trim())
    .filter((r) => r.length >= 2)
);
const teachers = computed(() => extractTeacherNames(props.event?.description || ""));
const groups = computed(() => (props.event?.sourceFiles || []).map((f) => f.replace(/\.ics$/i, "")));
const descriptionLines = computed(() => (props.event?.description || "").split("\n").filter((l) => l.trim()));
const isRu = computed(() => props.event && isRuEvent(props.event));
const isCercle = computed(() => props.event && isCercleEvent(props.event));

const goToTeacher = (teacher) => {
  emit("selectTeacher", teacher);
  emit("close");
  showToast(`Planning de ${teacher}`, "info");
};

const goToRoom = (room) => {
  emit("selectRoom", room);
  emit("close");
  showToast(`Planning de la salle ${room}`, "info");
};

const addToCalendar = () => {
  const blob = new Blob([buildSingleEventIcs(props.event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(props.event.summary || "cours").replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Événement téléchargé", "success");
};

const copyDetails = async () => {
  const ev = props.event;
  const text = `${ev.summary}\n${schedule.value}\nLieu : ${ev.location || "—"}\n${ev.description || ""}`.trim();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Détails copiés", "success");
  } catch {
    showToast("Impossible d'accéder au presse-papier", "error");
  }
};
</script>

<template>
  <component
    :is="smAndDown ? VBottomSheet : VDialog"
    v-model="open"
    :max-width="smAndDown ? undefined : 560"
    scrollable
  >
    <v-card v-if="event" v-swipe-dismiss="() => smAndDown && emit('close')" class="event-sheet" :aria-label="event.summary">
      <div v-if="smAndDown" class="grabber" aria-hidden="true" />
      <v-card-title class="sheet-title">{{ event.summary }}</v-card-title>

      <v-card-text class="sheet-body">
        <div v-if="isRu" class="source-banner ru">
          🍽️ <span><strong>Restaurant Universitaire Briff'O</strong> — menu officiel CROUS (CROUStillant Open Data)</span>
        </div>
        <div v-else-if="isCercle" class="source-banner cercle">
          🎉 <span><strong>Cercle des Élèves</strong> — agenda officiel du Cercle Esisar</span>
        </div>

        <v-list density="comfortable" bg-color="transparent" class="detail-list">
          <v-list-item :prepend-icon="mdiClockOutline" :title="schedule" />

          <v-list-item v-if="event.location" :prepend-icon="mdiMapMarkerOutline" :title="rooms.length && !isRu ? undefined : event.location">
            <div v-if="rooms.length || isRu" class="chip-row">
              <v-btn
                v-if="isRu"
                size="small"
                variant="tonal"
                :append-icon="mdiOpenInNew"
                href="https://www.crous-grenoble.fr/restaurant/ru-briffo-valence/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Site CROUS
              </v-btn>
              <v-btn v-for="r in rooms" :key="r" size="small" variant="tonal" :append-icon="mdiChevronRight" @click="goToRoom(r)">
                Salle {{ r }}
              </v-btn>
            </div>
          </v-list-item>

          <v-list-item v-if="teachers.length" :prepend-icon="mdiAccountOutline" title="Enseignant(s)">
            <div class="chip-row">
              <v-btn v-for="t in teachers" :key="t" size="small" variant="tonal" :append-icon="mdiChevronRight" @click="goToTeacher(t)">
                Planning {{ t }}
              </v-btn>
            </div>
          </v-list-item>

          <v-list-item v-if="groups.length" :prepend-icon="mdiAccountGroupOutline" title="Groupe(s)" :subtitle="groups.join(', ')" />

          <v-list-item v-if="descriptionLines.length" :prepend-icon="mdiTextBoxOutline" title="Détails">
            <p v-for="(line, i) in descriptionLines" :key="i" class="desc-line">{{ line }}</p>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions class="sheet-actions">
        <v-btn variant="tonal" :prepend-icon="mdiCalendarPlus" @click="addToCalendar">Ajouter au calendrier</v-btn>
        <v-btn variant="text" :prepend-icon="mdiContentCopy" @click="copyDetails">Copier</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Fermer</v-btn>
      </v-card-actions>
    </v-card>
  </component>
</template>

<style scoped>
.event-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}

.grabber {
  width: 36px;
  height: 4px;
  margin: 10px auto 0;
  border-radius: 2px;
  background: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.4;
}

.sheet-title {
  white-space: normal;
  font-weight: 700;
  line-height: 1.3;
  padding-top: 14px;
}

.sheet-body {
  padding-top: 0 !important;
}

.source-banner {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 12px;
  font-size: 0.85rem;
}

.source-banner.ru {
  background: rgba(234, 88, 12, 0.1);
}

.source-banner.cercle {
  background: rgba(168, 85, 247, 0.12);
}

.detail-list :deep(.v-list-item-title) {
  white-space: normal;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.desc-line {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.sheet-actions {
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 16px 12px;
}
</style>
