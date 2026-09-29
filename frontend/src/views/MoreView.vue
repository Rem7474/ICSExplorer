<script setup>
import { computed, inject } from "vue";
import {
  mdiCalendarSync, mdiLinkVariant, mdiDownload, mdiShareVariant, mdiWeatherNight, mdiSilverwareForkKnife,
  mdiSchool, mdiRefresh, mdiLogout, mdiGithub, mdiHeartPulse, mdiInformationOutline, mdiFileDownloadOutline,
  mdiCellphoneArrowDown,
} from "@mdi/js";
import { useInstallPrompt } from "../composables/useInstallPrompt.js";
import { useScheduleLinks } from "../composables/useScheduleLinks.js";
import { useTheme } from "../composables/useTheme.js";
import { usePersonalStore } from "../stores/personal.js";

// "Plus" screen: actions on the displayed schedule, display preferences,
// personal ADE schedule and about/diagnostics.
const schedule = inject("schedule");
const openPersonalSchedule = inject("openPersonalSchedule");
const { canCopyIcsLink, currentIcsUrl, webcalUrl, copyIcsLink, copyShareLink } = useScheduleLinks(schedule);
const { isDark, toggleTheme } = useTheme();
const personal = usePersonalStore();
const { available: canInstall, openSheet: openInstall } = useInstallPrompt();

const hasPersonal = computed(() => Boolean(schedule.personalScheduleInfo?.name) || personal.hasSavedCredentials());
const isPersonalShown = computed(() => schedule.selectedMode === "personal");

const rawVersion = import.meta.env.VITE_APP_VERSION || "";
const appVersion = rawVersion && !rawVersion.startsWith("v") ? `v${rawVersion}` : rawVersion;
</script>

<template>
  <div class="screen container more-screen">
    <v-list class="more-section" bg-color="transparent" lines="two">
      <v-list-subheader>Planning affiché · {{ schedule.scheduleLabel || "—" }}</v-list-subheader>
      <v-list-item
        v-if="canCopyIcsLink"
        :prepend-icon="mdiCalendarSync"
        title="S'abonner dans mon agenda"
        subtitle="Apple Calendar, Outlook, Thunderbird : mis à jour automatiquement"
        :href="webcalUrl"
      />
      <v-list-item
        v-if="canCopyIcsLink"
        :prepend-icon="mdiLinkVariant"
        title="Copier le lien du calendrier (.ics)"
        subtitle="Pour Google Agenda ou toute autre application"
        @click="copyIcsLink"
      />
      <v-list-item v-if="canCopyIcsLink" :prepend-icon="mdiDownload" title="Télécharger le fichier .ics" :href="currentIcsUrl" download />
      <v-list-item
        v-if="isPersonalShown"
        :prepend-icon="mdiFileDownloadOutline"
        title="Télécharger mon planning ADE (.ics)"
        @click="schedule.downloadPersonalIcs"
      />
      <v-list-item :prepend-icon="mdiShareVariant" title="Partager ce planning" subtitle="Copie un lien vers ce planning" @click="copyShareLink" />
    </v-list>

    <v-list v-if="canInstall" class="more-section" bg-color="transparent" lines="two">
      <v-list-item
        class="install-item"
        :prepend-icon="mdiCellphoneArrowDown"
        title="Installer l'application"
        subtitle="Sur l'écran d'accueil, en plein écran, même hors ligne"
        @click="openInstall"
      />
    </v-list>

    <v-list class="more-section" bg-color="transparent">
      <v-list-subheader>Affichage</v-list-subheader>
      <v-list-item :prepend-icon="mdiWeatherNight" title="Thème sombre" @click="toggleTheme">
        <template #append>
          <v-switch :model-value="isDark" color="primary" hide-details inset density="compact" aria-label="Thème sombre" @click.stop="toggleTheme" />
        </template>
      </v-list-item>
      <v-list-item :prepend-icon="mdiSilverwareForkKnife" title="Menu du RU" subtitle="Afficher le menu du restaurant universitaire" @click="schedule.toggleRuMenu()">
        <template #append>
          <v-switch
            :model-value="schedule.showRuMenu"
            color="primary"
            hide-details
            inset
            density="compact"
            aria-label="Menu du RU"
            @click.stop="schedule.toggleRuMenu()"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-list class="more-section" bg-color="transparent" lines="two">
      <v-list-subheader>Mon planning ADE</v-list-subheader>
      <v-list-item
        :prepend-icon="mdiSchool"
        :title="hasPersonal ? 'Changer de planning ADE' : 'Configurer mon planning ADE'"
        subtitle="UGA, Grenoble INP et toutes les universités ADE Campus"
        @click="openPersonalSchedule"
      />
      <v-list-item
        v-if="hasPersonal"
        :prepend-icon="mdiRefresh"
        title="Actualiser mon planning ADE"
        :subtitle="schedule.personalScheduleInfo?.lastUpdated ? `Mis à jour à ${schedule.personalScheduleInfo.lastUpdated}` : ''"
        @click="schedule.refreshPersonalSchedule()"
      />
      <v-list-item
        v-if="hasPersonal"
        :prepend-icon="mdiLogout"
        title="Oublier mon planning ADE"
        subtitle="Efface le planning et les identifiants enregistrés sur cet appareil"
        base-color="error"
        @click="schedule.clearPersonalSchedule()"
      />
    </v-list>

    <v-list class="more-section" bg-color="transparent">
      <v-list-subheader>À propos</v-list-subheader>
      <v-list-item :prepend-icon="mdiInformationOutline" title="ICSExplorer" :subtitle="appVersion || 'Version de développement'" />
      <v-list-item :prepend-icon="mdiGithub" title="Code source" href="https://github.com/Rem7474/ICSExplorer" target="_blank" rel="noopener" />
      <v-list-group value="diagnostic">
        <template #activator="{ props }">
          <v-list-item v-bind="props" :prepend-icon="mdiHeartPulse" title="Diagnostic" />
        </template>
        <v-list-item title="Santé API" href="/api/health" target="_blank" rel="noopener" />
        <v-list-item title="Statut synchro" href="/api/status" target="_blank" rel="noopener" />
        <v-list-item title="Index des fichiers" href="/output/files.json" target="_blank" rel="noopener" />
      </v-list-group>
    </v-list>
  </div>
</template>

<style scoped>
.more-screen {
  max-width: 720px;
}

.more-section {
  background: rgb(var(--v-theme-surface));
  border: 1px solid var(--border);
  border-radius: 16px;
  margin-bottom: 1rem;
  padding: 0.25rem 0;
}
</style>
