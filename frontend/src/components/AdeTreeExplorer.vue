<script setup>
/**
 * AdeTreeExplorer.vue — displays and navigates the ADE Campus tree hierarchy.
 *
 * Receives the full `tree` object from useAdeTree composable as a prop so that
 * it shares state seamlessly with PersonalScheduleModal.vue.
 */
defineProps({
  tree: { type: Object, required: true },
});

defineEmits(["back"]);
</script>

<template>
  <div class="modal-body tree-browser">
    <!-- Breadcrumbs + Root Reset -->
    <div class="tree-top-bar">
      <nav class="breadcrumbs" aria-label="Fil d Ariane">
        <span
          v-for="(crumb, idx) in tree.breadcrumbs.value"
          :key="idx"
          class="crumb"
          :class="{ active: idx === tree.breadcrumbs.value.length - 1 }"
          :title="crumb.name"
          @click="idx < tree.breadcrumbs.value.length - 1 && tree.navigateBreadcrumb(idx)"
        >
          {{ crumb.name }}
          <span v-if="idx < tree.breadcrumbs.value.length - 1" class="crumb-separator">/</span>
        </span>
      </nav>
      <button
        v-if="tree.breadcrumbs.value.length > 1"
        type="button"
        class="btn-root-reset"
        title="Revenir a la racine"
        @click="tree.navigateBreadcrumb(0)"
      >
        Racine globale
      </button>
    </div>

    <!-- Active Branch Quick Select -->
    <div
      v-if="tree.currentActiveBranch.value && tree.currentActiveBranch.value.id"
      class="current-branch-bar"
    >
      <div class="current-branch-info">
        <span class="current-branch-label">Dossier actif :</span>
        <span class="current-branch-name" :title="tree.currentActiveBranch.value.name">
          {{ tree.currentActiveBranch.value.name }}
        </span>
      </div>
      <button
        type="button"
        class="btn btn-select-current"
        :title="'Selectionner tout l emploi du temps de ' + tree.currentActiveBranch.value.name"
        @click="tree.chooseResource(tree.currentActiveBranch.value.id)"
      >
        Choisir ce dossier complet
      </button>
    </div>

    <!-- Search -->
    <div class="search-box">
      <input
        v-model="tree.searchQuery.value"
        type="search"
        placeholder="Filtrer les filieres, promotions ou groupes..."
        class="search-input"
      />
    </div>

    <!-- Node list -->
    <div v-if="tree.isLoading.value" class="tree-loading">
      <span class="spinner"></span> Chargement des plannings...
    </div>

    <div v-else-if="tree.filteredNodes.value.length === 0" class="tree-empty">
      <p>Aucun dossier ou planning trouve ici.</p>
    </div>

    <ul v-else class="node-list">
      <li
        v-for="node in tree.filteredNodes.value"
        :key="node.id || node.ID"
        class="node-item"
        :class="{ 'node-leaf': node.isLeaf, 'node-branch': !node.isLeaf }"
        tabindex="0"
        role="button"
        :title="node.name || node.Name"
        @click="tree.selectNode(node)"
        @keydown.enter="tree.selectNode(node)"
      >
        <div class="node-main">
          <span class="node-icon">{{ node.isLeaf ? "" : "" }}</span>
          <span class="node-name">{{ node.name || node.Name }}</span>
        </div>
        <div class="node-actions">
          <button
            v-if="!node.isLeaf"
            type="button"
            class="node-select-btn"
            :title="'Selectionner tout le dossier : ' + (node.name || node.Name)"
            @click.stop="tree.chooseResource(node)"
          >
            Choisir
          </button>
          <span class="node-badge">{{ node.isLeaf ? "Choisir" : "Ouvrir" }}</span>
        </div>
      </li>
    </ul>

    <div v-if="tree.errorMessage.value" class="error-banner">{{ tree.errorMessage.value }}</div>

    <div class="modal-footer">
      <button class="btn btn-outline" type="button" @click="$emit('back')">
        Modifier l URL ou les identifiants
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.tree-browser {
  min-height: 380px;
}

.tree-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  background: rgba(125, 125, 125, 0.08);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  flex: 1;
}

.btn-root-reset {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-root-reset:hover {
  background: var(--bg);
  border-color: #3b82f6;
  color: #3b82f6;
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

.search-box { width: 100%; }

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  font-size: 0.9rem;
}

.search-input:focus { border-color: #3b82f6; }

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

.node-branch { border-left: 3px solid #3b82f6; }
.node-leaf   { border-left: 3px solid #10b981; }

.node-main {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
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

.node-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.current-branch-label { color: var(--muted); }

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

.btn-select-current:hover { opacity: 0.9; }

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

@keyframes spin { to { transform: rotate(360deg); } }

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
