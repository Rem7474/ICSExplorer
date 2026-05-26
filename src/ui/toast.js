let containerEl = null;

const ensureContainer = () => {
  if (containerEl) return containerEl;
  containerEl = document.createElement("div");
  containerEl.className = "toast-container";
  containerEl.setAttribute("role", "status");
  containerEl.setAttribute("aria-live", "polite");
  document.body.appendChild(containerEl);
  return containerEl;
};

export const showToast = (message, { type = "info", duration = 3000 } = {}) => {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  const dismiss = () => {
    toast.classList.remove("toast-visible");
    const cleanup = () => toast.remove();
    toast.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(cleanup, 400);
  };

  setTimeout(dismiss, duration);
  return { dismiss };
};
