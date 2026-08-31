<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { fetchUniversities, fetchPersonalCalendar, fetchTreeNodes } from "../ics/api.js";

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
const isExploringTree = ref(false);
const errorMessage = ref("");

// Tree exploration state
const treeNodes = ref([]);
const breadcrumbs = ref([{ id: "", name: "Arborescence ADE" }]);
const searchQuery = ref("");

const handleKeydown = (e) => {
  if (e.key === "Escape") emit("close");
};

const getCredentialsPayload = () => {
  const usingUrl = inputMode.value === "url";
  return usingUrl
    ? { adeUrl: adeUrl.value, login: login.value, password: password.value }
    : {
        universityId: selectedUniversityId.value,
        resourceId: resourceId.value || undefined,
        login: login.value,
        password: password.value,
      };
};

const submitDirect = async (overrideResourceId = null, resourceName = "") => {
  const usingUrl = inputMode.value === "url";

  if (usingUrl && !adeUrl.value) {
    errorMessage.value = "Veuillez coller l'URL de votre planning ADE.";
    return;
  }
  if (!usingUrl && !selectedUniversityId.value) {
    errorMessage.value = "Veuillez choisir un établissement.";
    return;
  }
  if (!usingUrl && (!login.value || !password.value)) {
    errorMessage.value = "Veuillez remplir vos identifiants.";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const params = getCredentialsPayload();
    if (overrideResourceId) {
      params.resourceId = overrideResourceId;
    }

    const icsText = await fetchPersonalCalendar(params);

    const univ = universities.value.find((u) => u.id === selectedUniversityId.value);
    const universityName = usingUrl ? "ADE Direct" : (univ ? univ.name : selectedUniversityId.value);
    const finalName = resourceName || (overrideResourceId ? `Planning ${overrideResourceId}` : "Mon Planning ADE");

    const payloadToSave = {
      inputMode: inputMode.value,
      ...params,
      resourceId: overrideResourceId || resourceId.value,
      resourceName: finalName,
      universityName,
    };

    if (remember.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToSave));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    props.schedule.loadPersonalEvents(icsText, {
      name: finalName,
      universityId: selectedUniversityId.value,
      universityName,
      resourceId: overrideResourceId || resourceId.value,
      inputMode: inputMode.value,
    });
    emit("close");
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const exploreTree = async (branchId = "", branchName = "") => {
  const usingUrl = inputMode.value === "url";

  if (usingUrl && !adeUrl.value) {
    errorMessage.value = "Veuillez coller l'URL de votre planning ADE.";
    return;
  }
  if (!usingUrl && !selectedUniversityId.value) {
    errorMessage.value = "Veuillez choisir un établissement.";
    return;
  }
  if (!usingUrl && (!login.value || !password.value)) {
    errorMessage.value = "Veuillez renseigner vos identifiants pour explorer l'arbre.";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  searchQuery.value = "";

  try {
    const creds = getCredentialsPayload();

    let newBreadcrumbs = [...breadcrumbs.value];
    if (branchId && branchName) {
      newBreadcrumbs.push({ id: branchId, name: branchName });
    } else if (!branchId) {
      newBreadcrumbs = [{ id: "", name: "Arborescence ADE" }];
    }

    const branchPath = newBreadcrumbs
      .map((b) => b.id)
      .filter((id) => Boolean(id));

    const nodes = await fetchTreeNodes({
      ...creds,
      branchId: branchId || undefined,
      branchPath: branchPath.length > 0 ? branchPath : undefined,
    });

    treeNodes.value = nodes;
    isExploringTree.value = true;
    breadcrumbs.value = newBreadcrumbs;
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const navigateBreadcrumb = (index) => {
  const target = breadcrumbs.value[index];
  breadcrumbs.value = breadcrumbs.value.slice(0, index);
  exploreTree(target.id, target.name);
};

const currentActiveBranch = computed(() => {
  if (breadcrumbs.value.length <= 1) return null;
  return breadcrumbs.value[breadcrumbs.value.length - 1];
});

const chooseResource = (nodeOrId) => {
  let id = "";
  let name = "";
  if (typeof nodeOrId === "object" && nodeOrId !== null) {
    id = nodeOrId.ID || nodeOrId.id;
    name = nodeOrId.name || nodeOrId.Name || "";
  } else {
    id = nodeOrId;
    if (currentActiveBranch.value && currentActiveBranch.value.id === id) {
      name = currentActiveBranch.value.name;
    }
  }
  if (!id) return;
  resourceId.value = id;
  submitDirect(id, name);
};

const selectNode = (node) => {
  if (node.isLeaf) {
    chooseResource(node);
  } else {
    exploreTree(node.ID || node.id, node.name || node.Name);
  }
};

const filteredNodes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return treeNodes.value;
  return treeNodes.value.filter((n) => (n.name || n.Name || "").toLowerCase().includes(q));
});

const forgetCredentials = () => {
  localStorage.removeItem(STORAGE_KEY);
  password.value = "";
  resourceId.value = "";
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
    resourceId.value = saved.resourceId || "";
    login.value = saved.login;
    password.value = saved.password;
    remember.value = true;
    await submitDirect();
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
        <h2>{{ isExploringTree ? "🌳 Sélectionner un emploi du temps" : "🎓 Mon EDT personnel" }}</h2>
        <button class="close-btn" type="button" aria-label="Fermer" @click="emit('close')">✕</button>
      </div>

      <!-- Mode 1: Authentication / Connection Form -->
      <form v-if="!isExploringTree" class="modal-body" @submit.prevent="submitDirect()">
        <p class="modal-intro">
          Connectez-vous pour récupérer votre emploi du temps personnel ou explorer les plannings de votre école.
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
          <input id="resourceIdInput" v-model="resourceId" type="text" placeholder="ex : 1234 (ou laissez vide pour explorer)" />
          <p class="field-hint">
            Si vous connaissez votre numéro de ressource ou groupe, saisissez-le ici. Sinon, utilisez le bouton
            <strong>« Explorer l'arbre »</strong> ci-dessous.
          </p>
        </div>

        <div v-else class="field">
          <label for="adeUrlInput">URL de votre planning ADE</label>
          <input
            id="adeUrlInput"
            v-model="adeUrl"
            type="url"
            placeholder="https://ade-uga-ro-vs.grenet.fr/direct/index.jsp?data=... ou https://edt.grenoble-inp.fr/..."
          />
          <p class="field-hint">
            Collez n'importe quelle URL menant à votre planning ADE (lien direct, portail, export) — elle sera analysée automatiquement.
          </p>
        </div>

        <p v-if="inputMode === 'url'" class="field-hint">
          Laissez l'identifiant et le mot de passe vides si votre URL contient déjà votre jeton d'accès direct.
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
          Vos identifiants sont envoyés uniquement en mémoire pour interroger ADE et ne sont jamais stockés sur le serveur.
        </p>

        <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

        <div class="modal-footer">
          <button v-if="remember" class="btn btn-outline" type="button" @click="forgetCredentials">
            Oublier
          </button>
          <button class="btn btn-secondary" type="button" :disabled="isLoading" @click="exploreTree()">
            🌳 {{ isLoading ? "Chargement..." : "Explorer l'arbre" }}
          </button>
          <button class="btn btn-primary" type="submit" :disabled="isLoading">
            {{ isLoading ? "Connexion..." : "Charger directement" }}
          </button>
        </div>
      </form>

      <!-- Mode 2: Tree Browser & Selector -->
      <div v-else class="modal-body tree-browser">
        <!-- Breadcrumbs -->
        <nav class="breadcrumbs" aria-label="Fil d'Ariane">
          <span
            v-for="(crumb, idx) in breadcrumbs"
            :key="idx"
            class="crumb"
            :class="{ active: idx === breadcrumbs.length - 1 }"
            @click="idx < breadcrumbs.length - 1 && navigateBreadcrumb(idx)"
          >
            {{ crumb.name }}
            <span v-if="idx < breadcrumbs.length - 1" class="crumb-separator">/</span>
          </span>
        </nav>

        <!-- Current Active Branch Quick Select -->
        <div v-if="currentActiveBranch && currentActiveBranch.id" class="current-branch-bar">
          <div class="current-branch-info">
            <span class="current-branch-label">Dossier actif :</span>
            <span class="current-branch-name">{{ currentActiveBranch.name }}</span>
          </div>
          <button
            type="button"
            class="btn btn-select-current"
            :title="'Sélectionner tout l\'emploi du temps de ' + currentActiveBranch.name"
            @click="chooseResource(currentActiveBranch.id)"
          >
            📅 Choisir ce dossier complet
          </button>
        </div>

        <!-- Search box in active folder -->
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="🔍 Filtrer les filières, promotions ou groupes..."
            class="search-input"
          />
        </div>

        <!-- Node list -->
        <div v-if="isLoading" class="tree-loading">
          <span class="spinner"></span> Chargement des plannings...
        </div>

        <div v-else-if="filteredNodes.length === 0" class="tree-empty">
          <p>Aucun dossier ou planning trouvé ici.</p>
        </div>

        <ul v-else class="node-list">
          <li
            v-for="node in filteredNodes"
            :key="node.id || node.ID"
            class="node-item"
            :class="{ 'node-leaf': node.isLeaf, 'node-branch': !node.isLeaf }"
            tabindex="0"
            role="button"
            @click="selectNode(node)"
            @keydown.enter="selectNode(node)"
          >
            <div class="node-main">
              <span class="node-icon">{{ node.isLeaf ? "📅" : "📁" }}</span>
              <span class="node-name">{{ node.name || node.Name }}</span>
            </div>

            <div class="node-actions">
              <button
                v-if="!node.isLeaf"
                type="button"
                class="node-select-btn"
                title="Sélectionner tout ce dossier"
                @click.stop="chooseResource(node)"
              >
                📅 Choisir
              </button>
              <span class="node-badge">{{ node.isLeaf ? "Choisir" : "Ouvrir ➔" }}</span>
            </div>
          </li>
        </ul>

        <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

        <div class="modal-footer">
          <button class="btn btn-outline" type="button" @click="isExploringTree = false">
            ⬅ Retour aux identifiants
          </button>
        </div>
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
.field input,
.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  font-size: 0.9rem;
}

.field select:focus,
.field input:focus,
.search-input:focus {
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

/* Tree Browser Styles */
.tree-browser {
  min-height: 380px;
}

.search-box {
  width: 100%;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.85rem;
  background: rgba(125, 125, 125, 0.08);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
}

.crumb {
  cursor: pointer;
  color: #3b82f6;
  font-weight: 500;
}

.crumb.active {
  color: var(--text);
  font-weight: 600;
  cursor: default;
}

.crumb-separator {
  color: var(--muted);
  margin-left: 0.35rem;
}

.node-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 300px;
  overflow-y: auto;
}

.node-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.node-item:hover,
.node-item:focus {
  background: rgba(59, 130, 246, 0.08);
  border-color: #3b82f6;
  outline: none;
}

.node-main {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.node-branch {
  border-left: 3px solid #3b82f6;
}

.node-leaf {
  border-left: 3px solid #10b981;
}

.node-icon {
  font-size: 1.1rem;
  margin-right: 0.6rem;
}

.node-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(125, 125, 125, 0.12);
  color: var(--muted);
  font-weight: 600;
}

.node-leaf .node-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.node-select-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-select-btn:hover {
  background: #3b82f6;
  color: #fff;
}

.current-branch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}

.current-branch-info {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-branch-label {
  color: var(--muted);
}

.current-branch-name {
  color: var(--text);
  font-weight: 600;
}

.btn-select-current {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}

.btn-select-current:hover {
  opacity: 0.9;
}

.tree-loading,
.tree-empty {
  text-align: center;
  padding: 2rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(125, 125, 125, 0.3);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
