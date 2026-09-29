const CLOSE_DISTANCE = 90; // px dragged down to dismiss
const LOCK_DISTANCE = 8; // px before deciding between a drag and a scroll

const scrolledInside = (target, root) => {
  for (let node = target; node && node !== root; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
};

/**
 * v-swipe-dismiss="close": drag a bottom sheet down to close it. The gesture
 * is claimed (preventDefault) so the browser doesn't turn it into its own
 * pull-to-refresh; a drag that starts on scrolled content stays a scroll.
 */
export const vSwipeDismiss = {
  mounted(el, { value: onDismiss }) {
    let startX = 0;
    let startY = 0;
    let state = "idle"; // idle | maybe | dragging
    let dy = 0;

    const reset = (animate) => {
      el.style.transition = animate ? "transform 0.2s ease" : "";
      el.style.transform = "";
    };

    const onStart = (e) => {
      if (e.touches.length !== 1 || scrolledInside(e.target, el)) {
        state = "idle";
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dy = 0;
      state = "maybe";
    };

    const onMove = (e) => {
      if (state === "idle") return;
      const dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
      if (state === "maybe") {
        if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
        state = dy > 0 && dy > Math.abs(dx) ? "dragging" : "idle";
        if (state === "idle") return;
        el.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };

    const onEnd = () => {
      const wasDragging = state === "dragging";
      state = "idle";
      if (!wasDragging) return;
      if (dy > CLOSE_DISTANCE) {
        el.style.transition = "";
        el.style.transform = "";
        el.dispatchEvent(new CustomEvent("swipe-dismissed"));
        onDismiss?.();
      } else {
        reset(true);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
  },
};
