<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { fetchUniversities, fetchPersonalCalendar } from "../ics/api.js";

const STORAGE_KEY = "edtPersonalCreds";

const props = defineProps({
  schedule: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const universities = ref([]);
const selectedUniversityId = ref("");
const inputMode = ref("list"); // "list" | "url"
const adeUrl = ref("");
const resourceId = ref("");
const login = ref("");
const password = ref("");
const remember = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");

const handleKeydown = (e) => {
  if (e.key === "Escape") emit("close");
};

const submit = async () => {
  const usingUrl = inputMode.value === "url";

  if (usingUrl && !adeUrl.value) {
    errorMessage.value = "Veuillez coller l'URL de votre planning ADE.";
    return;
  }
  if (!usingUrl && !selectedUniversityId.value) {
    errorMessage.value = "Veuillez choisir un établissement.";
    return;
  }
  // Establishments from the list only support Basic Auth, so credentials are
  // mandatory there. A pasted URL may already embed its own access token, in
  // which case login/password can be left empty.
  if (!usingUrl && (!login.value || !password.value)) {
    errorMessage.value = "Veuillez remplir tous les champs.";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const params = usingUrl
      ? { adeUrl: adeUrl.value, login: login.value, password: password.value }
      : {
          universityId: selectedUniversityId.value,
          resourceId: resourceId.value || undefined,
          login: login.value,
          password: password.value,
        };

    const icsText = await fetchPersonalCalendar(params);

    if (remember.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputMode: inputMode.value, ...params }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    props.schedule.loadPersonalEvents(icsText, { universityId: selectedUniversityId.value });
    emit("close");
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const forgetCredentials = () => {
  localStorage.removeItem(STORAGE_KEY);
  password.value = "";
  remember.value = false;
};

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown);

  try {
    universities.value = await fetchUniversities();
  } catch (err) {
    errorMessage.value = err.message;
  }

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved?.login && saved?.password && (saved?.universityId || saved?.adeUrl)) {
    inputMode.value = saved.inputMode || (saved.adeUrl ? "url" : "list");
    selectedUniversityId.value = saved.universityId || "";
    adeUrl.value = saved.adeUrl || "";
    login.value = saved.login;
    password.value = saved.password;
    remember.value = true;
    await submit();
  } else if (universities.value.length > 0) {
    selectedUniversityId.value = universities.value[0].id;
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="modal-backdrop" @click="emit('close')">
    <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
      <div class="modal-header">
        <h2>🎓 Mon EDT personnel</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">✕</button>
      </div>

      <form class="modal-body" @submit.prevent="submit">
        <p class="modal-intro">
          Connectez-vous avec vos identifiants pour récupérer directement votre emploi du temps personnel,
          sans avoir à chercher une URL ICS.
        </p>

        <div class="mode-toggle">
          <label>
            <input v-model="inputMode" type="radio" value="list" />
            Choisir mon établissement
          </label>
          <label>
            <input v-model="inputMode" type="radio" value="url" />
            Coller mon URL ADE
          </label>
        </div>

        <div v-if="inputMode === 'list'" class="field">
          <label for="universitySelect">Établissement</label>
          <select id="universitySelect" v-model="selectedUniversityId">
            <option v-for="u in universities" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>

        <div v-if="inputMode === 'list'" class="field">
          <label for="resourceIdInput">Identifiant de ressource ADE (optionnel)</label>
          <input id="resourceIdInput" v-model="resourceId" type="text" placeholder="ex : 1234" />
          <p class="field-hint">
            Certains serveurs ADE exigent de connaître l'identifiant numérique de votre propre planning (visible
            dans l'URL quand vous consultez votre emploi du temps sur le portail ADE de votre établissement, après
            connexion). Laissez vide pour essayer sans.
          </p>
        </div>

        <div v-else class="field">
          <label for="adeUrlInput">URL de votre planning ADE</label>
          <input
            id="adeUrlInput"
            v-model="adeUrl"
            type="url"
            placeholder="https://edt.grenoble-inp.fr/2026-2027/esisar/etudiant/..."
          />
          <p class="field-hint">
            Collez n'importe quelle URL menant à votre planning ADE (lien du portail, export, ou page de
            consultation) — elle sera analysée automatiquement.
          </p>
        </div>

        <p v-if="inputMode === 'url'" class="field-hint">
          Laissez l'identifiant et le mot de passe vides si votre URL contient déjà votre propre jeton d'accès
          (certains liens ADE "accès direct" fonctionnent ainsi, sans identifiants séparés).
        </p>

        <div class="field">
          <label for="loginInput">Identifiant {{ inputMode === "url" ? "(optionnel)" : "" }}</label>
          <input id="loginInput" v-model="login" type="text" autocomplete="username" :required="inputMode === 'list'" />
        </div>

        <div class="field">
          <label for="passwordInput">Mot de passe {{ inputMode === "url" ? "(optionnel)" : "" }}</label>
          <input
            id="passwordInput"
            v-model="password"
            type="password"
            autocomplete="current-password"
            :required="inputMode === 'list'"
          />
        </div>

        <label class="remember-field">
          <input v-model="remember" type="checkbox" />
          Se souvenir de moi sur cet appareil
        </label>

        <p class="disclaimer">
          Votre mot de passe est envoyé une seule fois pour récupérer votre calendrier et n'est jamais stocké sur
          le serveur. Si vous cochez "se souvenir de moi", il est conservé uniquement dans le stockage local de ce
          navigateur, non chiffré — au même niveau de confiance qu'un mot de passe enregistré par votre navigateur.
        </p>

        <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

        <div class="modal-footer">
          <button v-if="remember" class="btn btn-outline" type="button" @click="forgetCredentials">
            Oublier mes identifiants
          </button>
          <button class="btn btn-primary" type="submit" :disabled="isLoading">
            {{ isLoading ? "Connexion..." : "Charger mon EDT" }}
          </button>
        </div>
      </form>
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
  width: min(480px, 100%);
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
  gap: 1rem;
}

.modal-intro {
  margin: 0;
  font-size: 0.9rem;
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
}

.remember-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.disclaimer {
  margin: 0;
  font-size: 0.8rem;
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
}
</style>
