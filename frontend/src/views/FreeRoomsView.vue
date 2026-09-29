<script setup>
import { computed, onMounted, ref } from "vue";
import { mdiDoorOpen, mdiChevronRight, mdiRefresh, mdiCalendarBlankOutline, mdiClockOutline } from "@mdi/js";
import { useScheduleStore } from "../stores/schedule.js";
import { useFreeRooms, toDateInput, toTimeInput } from "../composables/useFreeRooms.js";
import { usePullToRefresh } from "../composables/usePullToRefresh.js";
import PullIndicator from "../components/PullIndicator.vue";

// Salles libres: rooms free at a given moment (now by default), by building.
// Picking one opens its schedule on the Planning screen.
const schedule = useScheduleStore();
const { date, time, target, isLoading, rooms, searched, error, search, setMoment } = useFreeRooms();

onMounted(search);

const screenRef = ref(null);
const { distance: pullDistance, refreshing } = usePullToRefresh(screenRef, { onRefresh: search });

// Quick moments; the date/time fields cover everything else.
const moments = computed(() => {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 3600000);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0);
  return [
    { label: "Maintenant", at: now },
    { label: "Dans 1 h", at: inOneHour },
    { label: "Demain 8h", at: tomorrow },
  ];
});
const isMoment = (d) => date.value === toDateInput(d) && time.value === toTimeInput(d);

const building = ref("ALL");
const buildings = computed(() => {
  const counts = new Map();
  rooms.value.forEach((r) => counts.set(r.building, (counts.get(r.building) || 0) + 1));
  return [...counts]
    .sort(([a], [b]) => (a === "Autres") - (b === "Autres") || a.localeCompare(b))
    .map(([id, count]) => ({ id, count, label: id === "Autres" ? "Autres" : `Bât. ${id}` }));
});
const visibleRooms = computed(() =>
  building.value === "ALL" ? rooms.value : rooms.value.filter((r) => r.building === building.value)
);

const momentLabel = computed(() => {
  const t = target.value;
  if (Number.isNaN(t.getTime())) return "";
  const day = t.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `${day} à ${time.value.replace(":", "h")}`;
});
const summary = computed(() => {
  const n = visibleRooms.value.length;
  return `${n === 0 ? "Aucune" : n} salle${n > 1 ? "s" : ""} libre${n > 1 ? "s" : ""}`;
});
</script>

<template>
  <div ref="screenRef" class="rooms-screen">
    <PullIndicator :distance="pullDistance" :refreshing="refreshing" />
    <section class="when" aria-label="Moment recherché">
      <div class="moment-row">
        <v-chip
          v-for="m in moments"
          :key="m.label"
          :color="isMoment(m.at) ? 'primary' : undefined"
          :variant="isMoment(m.at) ? 'flat' : 'tonal'"
          @click="setMoment(m.at)"
        >
          {{ m.label }}
        </v-chip>
      </div>
      <div class="when-fields">
        <label class="when-field" for="roomDate">
          <v-icon :icon="mdiCalendarBlankOutline" size="20" />
          <span class="sr-only">Date</span>
          <input id="roomDate" v-model="date" type="date" required @change="search" />
        </label>
        <label class="when-field" for="roomTime">
          <v-icon :icon="mdiClockOutline" size="20" />
          <span class="sr-only">Heure</span>
          <input id="roomTime" v-model="time" type="time" step="900" required @change="search" />
        </label>
      </div>
    </section>

    <v-chip-group v-if="buildings.length > 1" v-model="building" mandatory class="building-row" aria-label="Bâtiment">
      <v-chip value="ALL" variant="tonal" filter>Tous · {{ rooms.length }}</v-chip>
      <v-chip v-for="b in buildings" :key="b.id" :value="b.id" variant="tonal" filter>{{ b.label }} · {{ b.count }}</v-chip>
    </v-chip-group>

    <div class="summary-row">
      <p class="summary" aria-live="polite">
        <template v-if="isLoading">Recherche des salles libres…</template>
        <template v-else-if="searched">
          <strong>{{ summary }}</strong> <span class="moment">{{ momentLabel }}</span>
        </template>
      </p>
      <v-btn :icon="mdiRefresh" variant="text" density="comfortable" aria-label="Actualiser" :loading="isLoading" @click="search" />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">{{ error }}</v-alert>

    <v-skeleton-loader v-if="isLoading && !rooms.length" type="list-item-avatar-two-line@5" class="list-card" />

    <v-list v-else-if="visibleRooms.length" class="list-card" :class="{ stale: isLoading }" bg-color="transparent" lines="two">
      <v-list-item
        v-for="item in visibleRooms"
        :key="item.room"
        class="room-item"
        :title="`Salle ${item.room}`"
        :subtitle="item.availabilityText"
        @click="schedule.loadRoomSchedule(item.room)"
      >
        <template #prepend>
          <v-avatar :color="item.isLimited ? 'warning' : 'success'" variant="tonal" rounded="lg">
            <v-icon :icon="mdiDoorOpen" />
          </v-avatar>
        </template>
        <template #append><v-icon :icon="mdiChevronRight" size="20" class="chevron" /></template>
      </v-list-item>
    </v-list>

    <div v-else-if="searched && !isLoading && !error" class="empty">
      <v-icon :icon="mdiDoorOpen" size="40" />
      <p>Aucune salle libre {{ building === "ALL" ? "" : "dans ce bâtiment " }}à ce moment-là.</p>
    </div>
  </div>
</template>

<style scoped>
.rooms-screen {
  position: relative;
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 12px 16px 1.5rem;
}

.when {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 6px;
}

.moment-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.when-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Native date/time pickers (wheels on iOS, dialogs on Android). */
.when-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 48px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}

.when-field:focus-within {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.when-field input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  font-size: 16px; /* no zoom on focus in iOS Safari */
  font-weight: 600;
  -webkit-appearance: none;
  appearance: none;
}

.building-row {
  margin: 0 -4px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0 8px;
}

.summary {
  margin: 0 4px;
  font-size: 0.92rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.summary strong {
  color: rgb(var(--v-theme-on-surface));
}

.list-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 4px 0;
  overflow: hidden;
}

.list-card.stale {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.chevron {
  opacity: 0.45;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 2.5rem 1rem;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
