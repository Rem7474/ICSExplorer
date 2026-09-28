<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  mdiArrowLeft, mdiClose, mdiSchool, mdiLinkVariant, mdiChevronRight, mdiCheck, mdiEyeOutline, mdiEyeOffOutline,
  mdiShieldLockOutline, mdiFolderOutline, mdiCalendarBlankOutline, mdiMagnify, mdiHome, mdiFolderOpenOutline,
} from "@mdi/js";
import { useAdeTree } from "../../composables/useAdeTree.js";
import { usePersonalStore } from "../../stores/personal.js";
import { useScheduleStore } from "../../stores/schedule.js";

// Personal ADE schedule set-up, as a full-screen flow on phones (sliding in
// from the right) and a dialog on wide screens:
//   1. institution (or "paste my ADE URL")  2. sign-in  3. pick a schedule in the ADE tree.
// Saved settings skip straight to step 3.
const emit = defineEmits(["close"]);

const schedule = useScheduleStore();
const personal = usePersonalStore();
const { smAndDown } = useDisplay();

const open = ref(true);
const close = () => (open.value = false);

const tree = useAdeTree({
  onCalendarLoaded: (icsText, meta) => {
    schedule.loadPersonalEvents(icsText, meta);
    close();
  },
});
const {
  universities, selectedUniversityId, inputMode, adeUrl, login, password, remember,
  breadcrumbs, searchQuery, isExploringTree, filteredNodes, treeNodes, currentActiveBranch, isLoading, errorMessage,
} = tree;

// Already configured: open on the tree (step 3) while it reloads.
const saved = personal.getSavedCredentials() || personal.personalScheduleInfo;
const step = ref(saved?.adeUrl || saved?.universityId ? 3 : 1);
const booting = ref(true);
const hadSavedCredentials = ref(personal.hasSavedCredentials());
watch(isExploringTree, (exploring) => exploring && (step.value = 3));

onMounted(async () => {
  await tree.restoreAndExplore(personal.personalScheduleInfo);
  booting.value = false;
  if (step.value === 3 && !isExploringTree.value) {
    // Credentials weren't remembered: ask for them, without an error upfront.
    step.value = 2;
    if (!password.value) errorMessage.value = "";
  }
});

// --------------------------------------------------------------- step 1
const universityQuery = ref("");
const visibleUniversities = computed(() => {
  const q = universityQuery.value.trim().toLowerCase();
  return q ? universities.value.filter((u) => u.name.toLowerCase().includes(q)) : universities.value;
});
const selectedUniversity = computed(() => universities.value.find((u) => u.id === selectedUniversityId.value));

const pickUniversity = (u) => {
  selectedUniversityId.value = u.id;
  inputMode.value = "list";
  errorMessage.value = "";
  step.value = 2;
};
const pickUrlMode = () => {
  inputMode.value = "url";
  errorMessage.value = "";
  step.value = 2;
};

// --------------------------------------------------------------- step 2
const showPassword = ref(false);
const submitCredentials = () => tree.exploreTree();
const forget = () => {
  tree.forgetCredentials();
  hadSavedCredentials.value = false;
};

// --------------------------------------------------------------- step 3
const inBranch = computed(() => breadcrumbs.value.length > 1);
const nodeName = (n) => n.name || n.Name;
const nodeKey = (n) => n.id || n.ID;

// --------------------------------------------------------------- chrome
const TITLES = { 1: "Mon établissement", 2: "Connexion à ADE", 3: "Choisir mon planning" };
const title = computed(() => TITLES[step.value]);

const back = () => {
  errorMessage.value = "";
  if (step.value === 3 && inBranch.value) tree.navigateBreadcrumb(breadcrumbs.value.length - 2);
  else if (step.value === 3) {
    isExploringTree.value = false;
    step.value = 2;
  } else if (step.value === 2) step.value = 1;
  else close();
};
const backLabel = computed(() =>
  step.value === 1 ? "Fermer" : step.value === 3 && inBranch.value ? "Dossier précédent" : "Étape précédente"
);
</script>

<template>
  <v-dialog
    v-model="open"
    :fullscreen="smAndDown"
    :max-width="smAndDown ? undefined : 560"
    :transition="smAndDown ? 'slide-x-reverse-transition' : 'dialog-transition'"
    scrollable
    @after-leave="emit('close')"
  >
    <v-card class="flow" :class="{ fullscreen: smAndDown }" :rounded="smAndDown ? 0 : 'xl'" aria-labelledby="flowTitle">
      <v-toolbar class="flow-bar" color="surface" density="comfortable">
        <v-btn :icon="step === 1 ? mdiClose : mdiArrowLeft" :aria-label="backLabel" @click="back" />
        <div class="flow-titles">
          <h2 id="flowTitle" class="flow-title">{{ title }}</h2>
          <span class="flow-step">Étape {{ step }} sur 3</span>
        </div>
        <v-btn v-if="step > 1" :icon="mdiClose" aria-label="Fermer" @click="close" />
        <v-progress-linear
          :model-value="(step / 3) * 100"
          :indeterminate="isLoading"
          color="primary"
          absolute
          location="bottom"
          height="3"
          aria-hidden="true"
        />
      </v-toolbar>

      <v-card-text class="flow-body">
        <v-window v-model="step" :touch="false" class="flow-window">
          <!-- 1. Institution -->
          <v-window-item :value="1">
            <p class="lead">Choisissez l'établissement dont vous voulez afficher le planning ADE.</p>
            <div v-if="universities.length > 8" class="field-pill">
              <v-icon :icon="mdiMagnify" size="20" />
              <input v-model="universityQuery" type="search" aria-label="Filtrer les établissements" placeholder="Rechercher un établissement" />
            </div>
            <v-skeleton-loader v-if="booting && !universities.length" type="list-item@4" class="list-card" />
            <v-list v-else class="list-card" bg-color="transparent" lines="one">
              <v-list-item
                v-for="u in visibleUniversities"
                :key="u.id"
                class="university-item"
                :title="u.name"
                @click="pickUniversity(u)"
              >
                <template #prepend><v-icon :icon="mdiSchool" /></template>
                <template #append><v-icon :icon="mdiChevronRight" size="20" class="chevron" /></template>
              </v-list-item>
            </v-list>
            <v-alert v-if="errorMessage && step === 1" type="warning" variant="tonal" density="compact" class="mb-3">
              {{ errorMessage }}
            </v-alert>
            <v-list class="list-card" bg-color="transparent" lines="two">
              <v-list-item
                class="url-item"
                title="Autre établissement"
                subtitle="Utiliser l'adresse de mon planning ADE"
                @click="pickUrlMode"
              >
                <template #prepend><v-icon :icon="mdiLinkVariant" /></template>
                <template #append><v-icon :icon="mdiChevronRight" size="20" class="chevron" /></template>
              </v-list-item>
            </v-list>
          </v-window-item>

          <!-- 2. Sign-in (a real form so password managers and iCloud Keychain can fill it) -->
          <v-window-item :value="2">
            <form id="adeLoginForm" class="login-form" @submit.prevent="submitCredentials">
              <v-chip v-if="inputMode === 'list' && selectedUniversity" class="picked" :prepend-icon="mdiSchool" variant="tonal" color="primary" @click="step = 1">
                {{ selectedUniversity.name }}
              </v-chip>

              <template v-if="inputMode === 'url'">
                <label class="field-label" for="adeUrlInput">Adresse de votre planning ADE</label>
                <input
                  id="adeUrlInput"
                  v-model="adeUrl"
                  class="field-input"
                  type="url"
                  inputmode="url"
                  autocapitalize="off"
                  spellcheck="false"
                  required
                  placeholder="https://ade…/direct/index.jsp?data=…"
                />
                <v-expansion-panels class="url-help" variant="accordion" flat>
                  <v-expansion-panel title="Où trouver cette adresse ?">
                    <v-expansion-panel-text>
                      <ol>
                        <li>Ouvrez votre planning ADE habituel (ENT, lien de l'école…).</li>
                        <li>Affichez l'emploi du temps de votre groupe.</li>
                        <li>Copiez l'adresse de la page, ou le lien d'export (« Exporter », « Lien ICS »).</li>
                      </ol>
                      <p>Seules les adresses <code>https://</code> publiques sont acceptées. Les liens contenant <code>?data=…</code> fonctionnent souvent sans identifiant.</p>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>

              <label class="field-label" for="loginInput">Identifiant{{ inputMode === "url" ? " (facultatif)" : "" }}</label>
              <input
                id="loginInput"
                v-model="login"
                class="field-input"
                type="text"
                name="username"
                autocomplete="username"
                autocapitalize="off"
                spellcheck="false"
                :required="inputMode === 'list'"
              />

              <label class="field-label" for="passwordInput">Mot de passe{{ inputMode === "url" ? " (facultatif)" : "" }}</label>
              <div class="password-wrap">
                <input
                  id="passwordInput"
                  v-model="password"
                  class="field-input"
                  :type="showPassword ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  :required="inputMode === 'list'"
                />
                <v-btn
                  :icon="showPassword ? mdiEyeOffOutline : mdiEyeOutline"
                  variant="text"
                  density="comfortable"
                  class="reveal-btn"
                  :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  @click="showPassword = !showPassword"
                />
              </div>

              <v-switch v-model="remember" class="remember" color="primary" inset hide-details density="compact" label="Se souvenir de moi sur cet appareil" />
              <p class="hint">
                {{ remember
                  ? "Vos identifiants restent dans ce navigateur pour actualiser le planning automatiquement. À éviter sur un appareil partagé."
                  : "Sans cette option, rien n'est conservé : il faudra vous reconnecter pour actualiser." }}
              </p>

              <p class="disclaimer">
                <v-icon :icon="mdiShieldLockOutline" size="18" />
                <span>Vos identifiants servent uniquement à interroger ADE et ne sont jamais stockés sur le serveur.</span>
              </p>

              <v-alert v-if="errorMessage && step === 2" type="error" variant="tonal" density="compact" class="mb-2" role="alert">
                {{ errorMessage }}
              </v-alert>

              <v-btn v-if="hadSavedCredentials" variant="text" color="error" size="small" class="forget-btn" @click="forget">
                Oublier mes identifiants enregistrés
              </v-btn>
            </form>
          </v-window-item>

          <!-- 3. ADE tree -->
          <v-window-item :value="3">
            <div class="crumbs" aria-label="Emplacement dans ADE">
              <v-chip
                v-for="(crumb, idx) in breadcrumbs"
                :key="`${idx}-${crumb.id}`"
                size="small"
                :variant="idx === breadcrumbs.length - 1 ? 'flat' : 'tonal'"
                :color="idx === breadcrumbs.length - 1 ? 'primary' : undefined"
                :prepend-icon="idx === 0 ? mdiHome : undefined"
                :title="crumb.name"
                :disabled="isLoading"
                @click="idx < breadcrumbs.length - 1 && tree.navigateBreadcrumb(idx)"
              >
                {{ idx === 0 ? "Racine" : crumb.name }}
              </v-chip>
            </div>

            <div v-if="treeNodes.length > 8" class="field-pill">
              <v-icon :icon="mdiMagnify" size="20" />
              <input v-model="searchQuery" type="search" aria-label="Filtrer les dossiers et plannings" placeholder="Filtrer (filière, promo, groupe…)" />
            </div>

            <v-skeleton-loader v-if="isLoading && !filteredNodes.length" type="list-item@6" class="list-card" />
            <div v-else-if="!filteredNodes.length" class="empty">
              <v-icon :icon="mdiFolderOpenOutline" size="40" />
              <p>Aucun dossier ni planning ici.</p>
            </div>
            <v-list v-else class="list-card" :class="{ stale: isLoading }" bg-color="transparent" lines="one">
              <v-list-item
                v-for="node in filteredNodes"
                :key="nodeKey(node)"
                class="node-item"
                :class="node.isLeaf ? 'node-leaf' : 'node-branch'"
                :title="nodeName(node)"
                :disabled="isLoading"
                @click="tree.selectNode(node)"
              >
                <template #prepend>
                  <v-icon :icon="node.isLeaf ? mdiCalendarBlankOutline : mdiFolderOutline" :color="node.isLeaf ? 'primary' : 'amber-darken-2'" />
                </template>
                <template #append>
                  <v-btn
                    v-if="!node.isLeaf"
                    variant="text"
                    size="small"
                    color="primary"
                    class="choose-btn"
                    :aria-label="`Choisir tout le dossier ${nodeName(node)}`"
                    @click.stop="tree.chooseResource(node)"
                  >
                    Choisir
                  </v-btn>
                  <v-icon :icon="node.isLeaf ? mdiCheck : mdiChevronRight" size="20" class="chevron" />
                </template>
              </v-list-item>
            </v-list>

            <v-alert v-if="errorMessage && step === 3" type="error" variant="tonal" density="compact" class="mt-3" role="alert">
              {{ errorMessage }}
            </v-alert>
          </v-window-item>
        </v-window>
      </v-card-text>

      <!-- Primary action, kept above the home indicator / keyboard. -->
      <v-card-actions v-if="step === 2 || (step === 3 && inBranch)" class="flow-actions">
        <v-btn
          v-if="step === 2"
          type="submit"
          form="adeLoginForm"
          color="primary"
          variant="flat"
          size="large"
          block
          :loading="isLoading"
        >
          Continuer
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          size="large"
          block
          class="choose-branch"
          :loading="isLoading"
          @click="tree.chooseResource(currentActiveBranch.id)"
        >
          Choisir tout « {{ currentActiveBranch.name }} »
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.flow.fullscreen {
  padding-top: env(safe-area-inset-top);
}

.flow-bar {
  position: relative;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border);
}

.flow-titles {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding-left: 4px;
  line-height: 1.2;
}

.flow-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-step {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.flow-body {
  padding: 16px !important;
}

.flow-window {
  overflow: visible;
}

.lead {
  margin: 0 0 12px;
  font-size: 0.95rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.list-card {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 4px 0;
  margin-bottom: 12px;
  overflow: hidden;
}

.list-card.stale {
  opacity: 0.6;
}

.chevron {
  opacity: 0.45;
}

/* ADE names are long ("M1 MSI Groupe 1 Gestion de Projets Agiles"): wrap them. */
.node-item :deep(.v-list-item-title),
.university-item :deep(.v-list-item-title) {
  white-space: normal;
  line-height: 1.3;
}

.field-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  margin-bottom: 12px;
  padding: 0 12px;
  border-radius: 22px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.field-pill input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  font-size: 16px;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.picked {
  align-self: flex-start;
  max-width: 100%;
  margin-bottom: 12px;
}

.field-label {
  margin: 10px 2px 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.field-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  font-size: 16px; /* no zoom on focus in iOS Safari */
  outline: none;
}

.field-input:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}

.password-wrap {
  position: relative;
}

.password-wrap .field-input {
  padding-right: 52px;
}

.reveal-btn {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
}

.url-help {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.url-help ol {
  padding-left: 1.2rem;
  margin: 0 0 8px;
}

.remember {
  margin-top: 14px;
}

.hint {
  margin: 2px 2px 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.disclaimer {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 16px 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.forget-btn {
  align-self: flex-start;
}

/* Breadcrumbs: one swipeable row. */
.crumbs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin: 0 -16px 12px;
  padding: 0 16px 2px;
  scrollbar-width: none;
}

.crumbs::-webkit-scrollbar {
  display: none;
}

.crumbs .v-chip {
  flex: 0 0 auto;
  max-width: 70vw;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 2rem 1rem;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

.flow-actions {
  flex: 0 0 auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom)) !important;
  border-top: 1px solid var(--border);
}

.choose-branch :deep(.v-btn__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
