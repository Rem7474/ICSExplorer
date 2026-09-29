<script setup>
import { mdiExportVariant, mdiPlusBoxOutline, mdiCheck, mdiCellphoneArrowDown } from "@mdi/js";
import { useInstallPrompt } from "../composables/useInstallPrompt.js";

// "Install the app" sheet: the browser's own prompt on Android, step-by-step
// instructions on iPhone (Safari has no install prompt).
const { sheetOpen, canPrompt, needsIosGuide, dismiss, install } = useInstallPrompt();
const iconUrl = "/apple-touch-icon.png"; // from public/, left untouched by the bundler
</script>

<template>
  <v-bottom-sheet v-model="sheetOpen" max-width="560" @update:model-value="(open) => !open && dismiss()">
    <v-card class="install-sheet">
      <div class="grabber" aria-hidden="true" />
      <div class="install-head">
        <img :src="iconUrl" alt="" width="56" height="56" class="install-icon" />
        <div>
          <h2 class="install-title">Installer ICSExplorer</h2>
          <p class="install-sub">Votre planning en un geste depuis l'écran d'accueil, en plein écran, même hors ligne.</p>
        </div>
      </div>

      <ol v-if="needsIosGuide && !canPrompt" class="steps">
        <li>
          <span class="step-icon"><v-icon :icon="mdiExportVariant" size="20" /></span>
          <span>Touchez <strong>Partager</strong> dans la barre du navigateur</span>
        </li>
        <li>
          <span class="step-icon"><v-icon :icon="mdiPlusBoxOutline" size="20" /></span>
          <span>Choisissez <strong>Sur l'écran d'accueil</strong> (faites défiler si besoin)</span>
        </li>
        <li>
          <span class="step-icon"><v-icon :icon="mdiCheck" size="20" /></span>
          <span>Touchez <strong>Ajouter</strong> : l'icône apparaît avec vos autres apps</span>
        </li>
      </ol>

      <div class="install-actions">
        <v-btn variant="text" @click="dismiss">Plus tard</v-btn>
        <v-btn v-if="canPrompt" color="primary" variant="flat" :prepend-icon="mdiCellphoneArrowDown" @click="install">Installer</v-btn>
        <v-btn v-else color="primary" variant="flat" @click="dismiss">J'ai compris</v-btn>
      </div>
    </v-card>
  </v-bottom-sheet>
</template>

<style scoped>
.install-sheet {
  padding: 0 20px calc(16px + env(safe-area-inset-bottom));
}

.grabber {
  width: 36px;
  height: 4px;
  margin: 10px auto 14px;
  border-radius: 2px;
  background: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.4;
}

.install-head {
  display: flex;
  gap: 14px;
  align-items: center;
}

.install-icon {
  flex: 0 0 56px;
  border-radius: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.install-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.install-sub {
  margin: 2px 0 0;
  font-size: 0.88rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.steps {
  list-style: none;
  margin: 18px 0 4px;
  padding: 0;
  counter-reset: step;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 0.95rem;
}

.step-icon {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.install-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
