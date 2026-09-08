<script setup>
import { onMounted, onUnmounted, unref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import { useAdeTree } from "../composables/useAdeTree.js";
import AdeTreeExplorer from "./AdeTreeExplorer.vue";

const props = defineProps({
  schedule: { type: Object, required: true },
});

const emit = defineEmits(["close"]);

const tree = useAdeTree({
  onCalendarLoaded: (icsText, meta) => {
    props.schedule.loadPersonalEvents(icsText, meta);
    emit("close");
  },
});

const handleKeydown = (e) => {
  if (e.key === "Escape") emit("close");
};

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown);
  const scheduleInfo = unref(props.schedule?.personalScheduleInfo);
  await tree.restoreAndExplore(scheduleInfo);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Dialog
    :visible="true"
    modal
    append-to="self"
    :closable="false"
    class="personal-schedule-dialog"
    :style="{ width: 'min(560px, 95vw)' }"
    @update:visible="emit('close')"
  >
    <template #header>
      <div class="modal-header-custom">
        <h2 class="dialog-title">
          <i :class="tree.isExploringTree.value ? 'pi pi-sitemap' : 'pi pi-user'" class="dialog-title-icon"></i>
          {{ tree.isExploringTree.value ? "Sélectionner un emploi du temps" : "Mon EDT personnel" }}
        </h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </template>

    <!-- Mode 1: Authentication form -->
    <form v-if="!tree.isExploringTree.value" class="modal-body" @submit.prevent="tree.exploreTree()">
      <p class="modal-intro">
        Connectez-vous pour explorer et sélectionner les plannings de votre établissement.
      </p>

      <div class="mode-toggle">
        <label class="toggle-option">
          <input v-model="tree.inputMode.value" type="radio" value="list" />
          <span>Choisir mon établissement</span>
        </label>
        <label class="toggle-option">
          <input v-model="tree.inputMode.value" type="radio" value="url" />
          <span>Coller mon URL ADE</span>
        </label>
      </div>

      <div v-if="tree.inputMode.value === 'list'" class="field">
        <label for="universitySelect">Établissement</label>
        <select id="universitySelect" v-model="tree.selectedUniversityId.value" class="styled-input">
          <option v-for="u in tree.universities.value" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </div>

      <div v-else class="field">
        <label for="adeUrlInput">URL de votre planning ADE</label>
        <input
          id="adeUrlInput"
          v-model="tree.adeUrl.value"
          type="url"
          class="styled-input"
          placeholder="https://ade-uga-ro-vs.grenet.fr/direct/index.jsp?data=..."
        />
        <p class="field-hint">
          Collez n'importe quelle URL menant à votre planning ADE — elle sera analysée automatiquement.
        </p>
      </div>

      <p v-if="tree.inputMode.value === 'url'" class="field-hint">
        Laissez les champs vides si votre URL contient déjà votre jeton d'accès direct.
      </p>

      <div class="field">
        <label for="loginInput">Identifiant {{ tree.inputMode.value === "url" ? "(optionnel)" : "" }}</label>
        <input
          id="loginInput"
          v-model="tree.login.value"
          type="text"
          class="styled-input"
          autocomplete="username"
          :required="tree.inputMode.value === 'list'"
        />
      </div>

      <div class="field">
        <label for="passwordInput">Mot de passe {{ tree.inputMode.value === "url" ? "(optionnel)" : "" }}</label>
        <input
          id="passwordInput"
          v-model="tree.password.value"
          type="password"
          class="styled-input"
          autocomplete="current-password"
          :required="tree.inputMode.value === 'list'"
        />
      </div>

      <label class="remember-field">
        <input v-model="tree.remember.value" type="checkbox" />
        <span>Se souvenir de moi sur cet appareil</span>
      </label>

      <p class="disclaimer">
        <i class="pi pi-shield"></i>
        Vos identifiants sont envoyés uniquement en mémoire pour interroger ADE et ne sont jamais stockés sur le serveur.
      </p>

      <div v-if="tree.errorMessage.value" class="error-banner">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ tree.errorMessage.value }}</span>
      </div>

      <div class="modal-footer">
        <Button
          v-if="tree.remember.value"
          label="Oublier"
          severity="secondary"
          variant="outlined"
          size="small"
          type="button"
          icon="pi pi-trash"
          @click="tree.forgetCredentials()"
        />
        <Button
          :label="tree.isLoading.value ? 'Chargement...' : 'Explorer et choisir mon planning'"
          :icon="tree.isLoading.value ? 'pi pi-spin pi-spinner' : 'pi pi-compass'"
          type="submit"
          :disabled="tree.isLoading.value"
        />
      </div>
    </form>

    <!-- Mode 2: Tree Explorer -->
    <AdeTreeExplorer
      v-else
      :tree="tree"
      @back="tree.isExploringTree.value = false"
    />
  </Dialog>
</template>

<style scoped>
.modal-header-custom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.dialog-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text);
}

.dialog-title-icon {
  color: var(--accent);
  font-size: 1.2rem;
}

.close-btn {
  background: transparent;
  border: none;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(125, 125, 125, 0.15);
  color: var(--text);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
}

.modal-intro {
  margin: 0;
  font-size: 0.88rem;
  color: var(--muted);
}

.mode-toggle {
  display: flex;
  gap: 1.25rem;
  font-size: 0.85rem;
  background: rgba(125, 125, 125, 0.08);
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
}

.toggle-option {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  font-weight: 500;
  color: var(--text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.styled-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  font-size: 0.9rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.styled-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.field-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.remember-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text);
  margin-top: 0.25rem;
}

.disclaimer {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.error-banner {
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
