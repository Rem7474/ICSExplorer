const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

let modalEl = null;
let contentEl = null;
let lastFocused = null;
let onCloseCb = null;

const handleKeydown = (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.key !== "Tab" || !contentEl) return;

  const focusable = Array.from(contentEl.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (e.shiftKey && (active === first || !contentEl.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
};

export const initModal = ({ modalElement, titleId }) => {
  modalEl = modalElement;
  contentEl = modalEl.querySelector(".modal-content");

  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  if (titleId) modalEl.setAttribute("aria-labelledby", titleId);

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
};

export const openModal = ({ onClose } = {}) => {
  if (!modalEl) return;
  lastFocused = document.activeElement;
  onCloseCb = onClose || null;
  modalEl.style.display = "flex";

  // Focus first focusable, fall back to content
  const focusable = contentEl.querySelectorAll(FOCUSABLE_SELECTOR);
  if (focusable.length) {
    focusable[0].focus();
  } else {
    contentEl.setAttribute("tabindex", "-1");
    contentEl.focus();
  }
  document.addEventListener("keydown", handleKeydown);
};

export const closeModal = () => {
  if (!modalEl) return;
  modalEl.style.display = "none";
  document.removeEventListener("keydown", handleKeydown);
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
  if (onCloseCb) onCloseCb();
  onCloseCb = null;
};

export const isModalOpen = () => modalEl && modalEl.style.display !== "none";
