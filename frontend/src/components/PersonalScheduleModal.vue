<script setup>
import { onMounted, onUnmounted, unref } from "vue";
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
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h2>{{ tree.isExploringTree.value ? "🌳 Sélectionner un emploi du temps" : "🎓 Mon EDT personnel" }}</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">✕</button>
      </div>

      <!-- Mode 1: Authentication form -->
      <form v-if="!tree.isExploringTree.value" class="modal-body" @submit.prevent="tree.exploreTree()">
        <p class="modal-intro">
          Connectez-vous pour explorer et selectionner les plannings de votre etablissement.
        </p>

        <div class="mode-toggle">
          <label>
            <input v-model="tree.inputMode.value" type="radio" value="list" />
            Choisir mon etablissement
          </label>
          <label>
            <input v-model="tree.inputMode.value" type="radio" value="url" />
            Coller mon URL ADE
          </label>
        </div>

        <div v-if="tree.inputMode.value === 'list'" class="field">
          <label for="universitySelect">Etablissement</label>
          <select id="universitySelect" v-model="tree.selectedUniversityId.value">
            <option v-for="u in tree.universities.value" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>

        <div v-else class="field">
          <label for="adeUrlInput">URL de votre planning ADE</label>
          <input
            id="adeUrlInput"
            v-model="tree.adeUrl.value"
            type="url"
            placeholder="https://ade-uga-ro-vs.grenet.fr/direct/index.jsp?data=..."
          />
          <p class="field-hint">
            Collez n importe quelle URL menant a votre planning ADE - elle sera analysee automatiquement.
          </p>
        </div>

        <p v-if="tree.inputMode.value === 'url'" class="field-hint">
          Laissez les champs vides si votre URL contient deja votre jeton d acces direct.
        </p>

        <div class="field">
          <label for="loginInput">Identifiant {{ tree.inputMode.value === "url" ? "(optionnel)" : "" }}</label>
          <input id="loginInput" v-model="tree.login.value" type="text" autocomplete="username" :required="tree.inputMode.value === 'list'" />
        </div>

        <div class="field">
          <label for="passwordInput">Mot de passe {{ tree.inputMode.value === "url" ? "(optionnel)" : "" }}</label>
          <input
            id="passwordInput"
            v-model="tree.password.value"
            type="password"
            autocomplete="current-password"
            :required="tree.inputMode.value === 'list'"
          />
        </div>

        <label class="remember-field">
          <input v-model="tree.remember.value" type="checkbox" />
          Se souvenir de moi sur cet appareil
        </label>

        <p class="disclaimer">
          Vos identifiants sont envoyes uniquement en memoire pour interroger ADE et ne sont jamais stockes sur le serveur.
        </p>

        <div v-if="tree.errorMessage.value" class="error-banner">{{ tree.errorMessage.value }}</div>

        <div class="modal-footer">
          <button v-if="tree.remember.value" class="btn btn-outline" type="button" @click="tree.forgetCredentials()">
            Oublier
          </button>
          <button class="btn btn-primary" type="submit" :disabled="tree.isLoading.value">
            {{ tree.isLoading.value ? "Chargement..." : "Explorer et choisir mon planning" }}
          </button>
        </div>
      </form>

      <!-- Mode 2: Tree Explorer -->
      <AdeTreeExplorer
        v-else
        :tree="tree"
        @back="tree.isExploringTree.value = false"
      />
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
  max-height: 90vh;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.15rem;
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
  gap: 1rem;
  overflow-y: auto;
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
}

.mode-toggle label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.field select,
.field input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  font-size: 0.9rem;
}

.field select:focus,
.field input:focus {
  border-color: #3b82f6;
}

.remember-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.disclaimer {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.4;
}

.error-banner {
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.85rem;
}

.modal-footer {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
