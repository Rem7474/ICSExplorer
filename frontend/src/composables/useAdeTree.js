import { ref, computed } from "vue";
import { fetchUniversities, fetchPersonalCalendar, fetchTreeNodes } from "../ics/api.js";

const STORAGE_KEY = "edtPersonalCreds";

/**
 * useAdeTree encapsulates ADE tree exploration state and actions.
 * Manages credentials form, tree navigation (breadcrumbs, nodes, search)
 * and calendar submission for PersonalScheduleModal.vue.
 *
 * @param {Object} options
 * @param {Function} options.onCalendarLoaded - called with (icsText, meta) when a calendar is fetched
 */
export function useAdeTree({ onCalendarLoaded } = {}) {
  // Credential form state
  const universities = ref([]);
  const selectedUniversityId = ref("");
  const inputMode = ref("list"); // "list" | "url"
  const adeUrl = ref("");
  const resourceId = ref("");
  const login = ref("");
  const password = ref("");
  const remember = ref(false);

  // Tree state
  const treeNodes = ref([]);
  const breadcrumbs = ref([{ id: "", name: "Arborescence globale" }]);
  const searchQuery = ref("");
  const isExploringTree = ref(false);

  // UI state
  const isLoading = ref(false);
  const errorMessage = ref("");

  // Derived
  const filteredNodes = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return treeNodes.value;
    return treeNodes.value.filter((n) =>
      (n.name || n.Name || "").toLowerCase().includes(q)
    );
  });

  const currentActiveBranch = computed(() => {
    if (breadcrumbs.value.length <= 1) return null;
    return breadcrumbs.value[breadcrumbs.value.length - 1];
  });

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

  const validateForm = () => {
    const usingUrl = inputMode.value === "url";
    if (usingUrl && !adeUrl.value) {
      errorMessage.value = "Veuillez coller l URL de votre planning ADE.";
      return false;
    }
    if (!usingUrl && !selectedUniversityId.value) {
      errorMessage.value = "Veuillez choisir un etablissement.";
      return false;
    }
    if (!usingUrl && (!login.value || !password.value)) {
      errorMessage.value = "Veuillez remplir vos identifiants.";
      return false;
    }
    return true;
  };

  /** Fetch and load tree nodes for the given branch (or root if branchId is empty). */
  const exploreTree = async (branchId = "", branchName = "") => {
    if (!validateForm()) return;

    isLoading.value = true;
    errorMessage.value = "";
    searchQuery.value = "";

    try {
      const creds = getCredentialsPayload();

      let newBreadcrumbs = [...breadcrumbs.value];
      if (branchId && branchName) {
        newBreadcrumbs.push({ id: branchId, name: branchName });
      } else if (!branchId) {
        newBreadcrumbs = [{ id: "", name: "Arborescence globale" }];
      }

      const branchPath = newBreadcrumbs.map((b) => b.id).filter(Boolean);

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

  /** Navigate up to a specific breadcrumb position. */
  const navigateBreadcrumb = (index) => {
    const target = breadcrumbs.value[index];
    breadcrumbs.value = breadcrumbs.value.slice(0, index);
    exploreTree(target.id, target.name);
  };

  /** Submit a specific resource ID and optional branchPath as the chosen calendar. */
  const submitDirect = async (overrideResourceId = null, resourceName = "", branchPath = []) => {
    if (!validateForm()) return;

    isLoading.value = true;
    errorMessage.value = "";

    try {
      const params = getCredentialsPayload();
      if (overrideResourceId) params.resourceId = overrideResourceId;
      if (branchPath && branchPath.length > 0) params.branchPath = branchPath;

      const icsText = await fetchPersonalCalendar(params);

      const univ = universities.value.find((u) => u.id === selectedUniversityId.value);
      const universityName =
        inputMode.value === "url" ? "ADE Direct" : (univ?.name || selectedUniversityId.value);
      const finalName =
        resourceName || (overrideResourceId ? `Planning ${overrideResourceId}` : "Mon Planning ADE");

      const payloadToSave = {
        inputMode: inputMode.value,
        ...params,
        resourceId: overrideResourceId || resourceId.value,
        resourceName: finalName,
        universityName,
        branchPath: branchPath || [],
      };

      if (remember.value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToSave));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      onCalendarLoaded?.(icsText, {
        ...payloadToSave,
        name: finalName,
        universityId: selectedUniversityId.value,
        universityName,
        resourceId: overrideResourceId || resourceId.value,
        inputMode: inputMode.value,
        branchPath: branchPath || [],
      });
    } catch (err) {
      errorMessage.value = err.message;
    } finally {
      isLoading.value = false;
    }
  };

  /** Choose a resource node or a bare resource ID and submit. */
  const chooseResource = (nodeOrId) => {
    let id;
    let name = "";
    let branchPath = [];

    if (typeof nodeOrId === "object" && nodeOrId !== null) {
      id = nodeOrId.ID || nodeOrId.id;
      name = nodeOrId.name || nodeOrId.Name || "";
      branchPath = breadcrumbs.value.map((b) => b.id).filter(Boolean);
      if (!nodeOrId.isLeaf) branchPath.push(id);
    } else {
      id = nodeOrId;
      if (currentActiveBranch.value?.id === id) {
        name = currentActiveBranch.value.name;
        branchPath = breadcrumbs.value.map((b) => b.id).filter(Boolean);
      }
    }
    if (!id) return;
    resourceId.value = id;
    submitDirect(id, name, branchPath);
  };

  /** Handle node click: navigate into folder or load leaf calendar. */
  const selectNode = (node) => {
    if (node.isLeaf) {
      chooseResource(node);
    } else {
      exploreTree(node.ID || node.id, node.name || node.Name);
    }
  };

  /** Wipe saved credentials from localStorage. */
  const forgetCredentials = () => {
    localStorage.removeItem(STORAGE_KEY);
    password.value = "";
    resourceId.value = "";
    remember.value = false;
  };

  /** Restore saved credentials and auto-explore tree. */
  const restoreAndExplore = async (scheduleInfo) => {
    try {
      universities.value = await fetchUniversities();
    } catch (err) {
      errorMessage.value = err.message;
    }

    let saved = null;
    try {
      saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ||
          localStorage.getItem("personalAdeCredentials") ||
          localStorage.getItem("edt_personal_meta") ||
          localStorage.getItem("personalScheduleMeta") ||
          "null"
      );
    } catch {}

    const config = saved || scheduleInfo;

    if (config && (config.adeUrl || config.universityId)) {
      inputMode.value = config.inputMode || (config.adeUrl ? "url" : "list");
      selectedUniversityId.value = config.universityId || universities.value[0]?.id || "";
      adeUrl.value = config.adeUrl || "";
      resourceId.value = config.resourceId || "";
      login.value = config.login || "";
      password.value = config.password || "";
      remember.value = Boolean(saved);
      await exploreTree("", "Arborescence globale");
    } else if (universities.value.length > 0) {
      selectedUniversityId.value = universities.value[0].id;
    }
  };

  return {
    // Credential form
    universities, selectedUniversityId, inputMode, adeUrl, resourceId,
    login, password, remember,
    // Tree
    treeNodes, breadcrumbs, searchQuery, isExploringTree,
    filteredNodes, currentActiveBranch,
    // UI
    isLoading, errorMessage,
    // Actions
    exploreTree, navigateBreadcrumb, submitDirect,
    selectNode, chooseResource, forgetCredentials, restoreAndExplore,
  };
}
