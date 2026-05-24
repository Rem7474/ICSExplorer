import { escapeHtml } from "../utils/dom.js";

const STORAGE_KEY = "edtFavorites";
const MAX_FAVORITES = 8;

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const save = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
};

const selectionKey = (sel) =>
  `${sel.mode || "student"}|${sel.year || ""}|${sel.track || ""}|${sel.type || ""}|${sel.rest || ""}`;

const labelFor = (sel) => {
  if (sel.mode === "teacher" && sel.teacher) return sel.teacher;
  if (sel.mode === "room" && sel.room) return `Salle ${sel.room}`;
  return [sel.year, sel.track, sel.type].filter(Boolean).join(" ") || "EDT";
};

export const createFavorites = ({
  container,
  addButton,
  getCurrentSelection,
  onApply,
}) => {
  let items = load();

  const render = () => {
    container.innerHTML = "";
    if (!items.length) {
      container.classList.add("favorites-empty");
      return;
    }
    container.classList.remove("favorites-empty");

    const currentKey = selectionKey(getCurrentSelection());

    for (const fav of items) {
      const isActive = selectionKey(fav) === currentKey;
      const pill = document.createElement("div");
      pill.className = `fav-pill ${isActive ? "active" : ""}`;
      pill.innerHTML = `
        <button type="button" class="fav-apply" aria-label="Charger ${escapeHtml(fav.label)}">${escapeHtml(fav.label)}</button>
        <button type="button" class="fav-remove" aria-label="Retirer ${escapeHtml(fav.label)} des favoris">✕</button>
      `;
      pill.querySelector(".fav-apply").addEventListener("click", () => {
        onApply(fav);
      });
      pill.querySelector(".fav-remove").addEventListener("click", () => {
        items = items.filter((f) => selectionKey(f) !== selectionKey(fav));
        save(items);
        render();
      });
      container.appendChild(pill);
    }
  };

  const refreshActiveState = () => render();

  const addCurrent = () => {
    const sel = getCurrentSelection();
    if (!sel.mode) return { ok: false, reason: "Aucune sélection." };
    if (sel.mode === "student" && !(sel.year && sel.track && sel.type && sel.rest)) {
      return { ok: false, reason: "Sélection incomplète." };
    }
    if (sel.mode === "teacher" && !sel.teacher) {
      return { ok: false, reason: "Aucun professeur sélectionné." };
    }
    if (sel.mode === "room" && !sel.room) {
      return { ok: false, reason: "Aucune salle sélectionnée." };
    }
    const newFav = { ...sel, label: labelFor(sel) };
    const key = selectionKey(newFav);
    if (items.some((f) => selectionKey(f) === key)) {
      return { ok: false, reason: "Déjà dans les favoris." };
    }
    items = [...items, newFav].slice(-MAX_FAVORITES);
    save(items);
    render();
    return { ok: true };
  };

  if (addButton) {
    addButton.addEventListener("click", () => {
      const result = addCurrent();
      addButton.dispatchEvent(
        new CustomEvent("favorite:added", { detail: result })
      );
    });
  }

  render();

  return { render, refreshActiveState, addCurrent };
};
